import { type DataQuery, type DataSourceInstanceListItem, dateTime, type TimeRange } from '@grafana/data';

import {
  APP_OBSERVABILITY_APP_ID,
  FRONTEND_OBSERVABILITY_APP_ID,
  HOSTED_TRACES_APP_ID,
  SYNTHETIC_MONITORING_APP_ID,
} from './appPluginIds';
import { fetchFaroApps } from './frontendObservabilityApi';
import {
  createTtlCachedPromise,
  findDatasourceWithData,
  listProbeCandidates,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
  withRetry,
  withTimeout,
} from './probeUtils';
import { readScalar, runDatasourceQueries, runInstantQueries } from './promQuery';

// "Seen recently" lookback shared by all data probes, tolerating scrape/ingest gaps.
const DATA_LOOKBACK_HOURS = 24;

// True when any probed candidate datasource of `type` satisfies `hasData`. Throws when nothing
// was found and any candidate errored: an errored datasource may hold the data, so absence is
// only settled when every candidate probed clean.
async function probeFound(
  type: string,
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>
): Promise<boolean> {
  const candidates = await listProbeCandidates(type);
  let errored = 0;
  // findDatasourceWithData requires a non-throwing callback; count failures for the unknown check.
  const guardedHasData = async (ds: DataSourceInstanceListItem) => {
    try {
      return await hasData(ds);
    } catch {
      errored++;
      return false;
    }
  };
  const found = await findDatasourceWithData(candidates, guardedHasData);
  if (found) {
    return true;
  }
  if (errored > 0) {
    throw new Error(`${errored} ${type} datasource probe(s) failed with no data found elsewhere`);
  }
  return false;
}

// Any series in the lookback means the solution produces data; which datasource holds it is irrelevant.
async function prometheusHasMetric(expr: string): Promise<boolean> {
  return probeFound('prometheus', async (ds) => {
    const frames = await withRetry(() => runInstantQueries({ probe: expr }, ds, PROBE_TIMEOUT_MS));
    return (readScalar(frames, 'probe') ?? 0) > 0;
  });
}

interface TempoSearchQuery extends DataQuery {
  query: string;
  limit: number;
}

async function tempoHasTraces(ds: DataSourceInstanceListItem): Promise<boolean> {
  const toTime = dateTime();
  const fromTime = dateTime().subtract(DATA_LOOKBACK_HOURS, 'h');
  const range: TimeRange = {
    from: fromTime,
    to: toTime,
    raw: { from: `now-${DATA_LOOKBACK_HOURS}h`, to: 'now' },
  };
  // Tempo search target: match-all TraceQL, one result is enough to prove data exists.
  const target: TempoSearchQuery = { refId: 'traces', queryType: 'traceql', query: '{}', limit: 1 };
  const frames = await withRetry(() => runDatasourceQueries([target], range, ds, PROBE_TIMEOUT_MS));
  return frames.some((frame) => frame.length > 0);
}

// Frontend Observability telemetry lives behind the Faro collector, not in a probeable stack
// datasource — a configured app in its registry is what "set up" means. Timeout-bounded so a
// hung request cannot hold the whole recommendations section.
async function hasFrontendObservabilityData(): Promise<boolean> {
  const apps = await withRetry(() => withTimeout(fetchFaroApps(), PROBE_TIMEOUT_MS));
  return apps.length > 0;
}

// Keyed by the recommended app's plugin id.
const probesBySolution: Record<string, { get(): Promise<boolean>; reset(): void }> = {
  // Synthetic Monitoring stores check results as Prometheus metrics; sm_check_info is its info metric.
  [SYNTHETIC_MONITORING_APP_ID]: createTtlCachedPromise(
    () => prometheusHasMetric(`count(last_over_time(sm_check_info[${DATA_LOOKBACK_HOURS}h]))`),
    PROBE_TTL_MS
  ),
  // Application Observability span metrics arrive under two supported naming schemes:
  // the spanmetrics connector emits traces_spanmetrics_*, OTel/Alloy emits traces_span_metrics_*.
  [APP_OBSERVABILITY_APP_ID]: createTtlCachedPromise(
    () =>
      prometheusHasMetric(
        `count(last_over_time(traces_spanmetrics_calls_total[${DATA_LOOKBACK_HOURS}h])) or count(last_over_time(traces_span_metrics_calls_total[${DATA_LOOKBACK_HOURS}h]))`
      ),
    PROBE_TTL_MS
  ),
  [HOSTED_TRACES_APP_ID]: createTtlCachedPromise(() => probeFound('tempo', tempoHasTraces), PROBE_TTL_MS),
  [FRONTEND_OBSERVABILITY_APP_ID]: createTtlCachedPromise(hasFrontendObservabilityData, PROBE_TTL_MS),
};

/**
 * True when the solution already receives data. An empty candidate list (or empty Faro registry)
 * is definitive no-data; an errored probe — including any candidate failing while no data was
 * found elsewhere — reports true: unknown fails toward hiding the recommendation.
 */
export async function hasSolutionData(pluginId: string): Promise<boolean> {
  const probe = probesBySolution[pluginId];
  if (!probe) {
    // No probe defined: data can never be confirmed, so the solution stays recommendable.
    return false;
  }
  try {
    return await probe.get();
  } catch {
    return true;
  }
}

// Reset the cached probe resolutions (test seam).
export function resetSolutionDataProbes(): void {
  Object.values(probesBySolution).forEach((probe) => probe.reset());
}

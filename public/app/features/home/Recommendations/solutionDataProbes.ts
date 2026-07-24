import { type DataQuery, type DataSourceInstanceListItem, dateTime, type TimeRange } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';

import {
  APP_OBSERVABILITY_APP_ID,
  FRONTEND_OBSERVABILITY_APP_ID,
  HOSTED_TRACES_APP_ID,
  SYNTHETIC_MONITORING_APP_ID,
} from './appPluginIds';
import {
  createTtlCachedPromise,
  findDatasourceWithData,
  listProbeCandidates,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
  withRetry,
} from './probeUtils';
import { readScalar, runDatasourceQueries, runInstantQueries } from './promQuery';

// "Seen recently" lookback shared by all data probes, tolerating scrape/ingest gaps.
const DATA_LOOKBACK_HOURS = 24;

// True when any probed candidate datasource of `type` satisfies `hasData`.
async function probeFound(
  type: string,
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>
): Promise<boolean> {
  return (await findDatasourceWithData(await listProbeCandidates(type), hasData)) !== null;
}

// Any series in the lookback means the solution produces data; which datasource holds it is irrelevant.
async function prometheusHasMetric(expr: string): Promise<boolean> {
  return probeFound('prometheus', async (ds) => {
    try {
      const frames = await withRetry(() => runInstantQueries({ probe: expr }, ds, PROBE_TIMEOUT_MS));
      return (readScalar(frames, 'probe') ?? 0) > 0;
    } catch {
      // An unusable datasource must not decide the probe.
      return false;
    }
  });
}

interface TempoSearchQuery extends DataQuery {
  query: string;
  limit: number;
}

async function tempoHasTraces(ds: DataSourceInstanceListItem): Promise<boolean> {
  try {
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
  } catch {
    return false;
  }
}

// Frontend Observability keeps its instrumented apps in the stack-local FaroApp registry; a
// configured app means the solution is set up (its telemetry lives behind the Faro collector,
// not in a probeable stack datasource).
async function hasFrontendObservabilityData(): Promise<boolean> {
  const response = await withRetry(() =>
    getBackendSrv().get<{ items?: unknown[] }>(
      `/apis/faro.ext.grafana.app/v1alpha1/namespaces/${config.namespace}/faroapps`
    )
  );
  return (response.items ?? []).length > 0;
}

// Keyed by the recommended app's plugin id.
const probesBySolution: Record<string, { get(): Promise<boolean>; reset(): void }> = {
  // Synthetic Monitoring stores check results as Prometheus metrics; sm_check_info is its info metric.
  [SYNTHETIC_MONITORING_APP_ID]: createTtlCachedPromise(
    () => prometheusHasMetric(`count(last_over_time(sm_check_info[${DATA_LOOKBACK_HOURS}h]))`),
    PROBE_TTL_MS
  ),
  // Application Observability is powered by Tempo metrics-generator span metrics.
  [APP_OBSERVABILITY_APP_ID]: createTtlCachedPromise(
    () => prometheusHasMetric(`count(last_over_time(traces_spanmetrics_calls_total[${DATA_LOOKBACK_HOURS}h]))`),
    PROBE_TTL_MS
  ),
  [HOSTED_TRACES_APP_ID]: createTtlCachedPromise(() => probeFound('tempo', tempoHasTraces), PROBE_TTL_MS),
  [FRONTEND_OBSERVABILITY_APP_ID]: createTtlCachedPromise(hasFrontendObservabilityData, PROBE_TTL_MS),
};

/**
 * True when the solution already receives data. Failure semantics: an empty candidate list (or
 * empty Faro registry) is definitive no-data; a probe that errors out reports true — unknown
 * fails toward hiding the recommendation, matching the pre-probe behavior for enabled apps.
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

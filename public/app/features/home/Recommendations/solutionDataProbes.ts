import { type DataSourceInstanceListItem } from '@grafana/data';

import {
  APP_OBSERVABILITY_APP_ID,
  FRONTEND_OBSERVABILITY_APP_ID,
  HOSTED_TRACES_APP_ID,
  SYNTHETIC_MONITORING_APP_ID,
} from './appPluginIds';
import { fetchFaroApps } from './frontendObservabilityApi';
import {
  createTtlCachedPromise,
  filterHealthyDatasources,
  findDatasourceWithData,
  listProbeCandidates,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
  probeProxyGet,
  withRetry,
  withTimeout,
} from './probeUtils';
import { readScalar, runInstantQueries } from './promQuery';

// "Seen recently" lookback shared by all data probes, tolerating scrape/ingest gaps.
export const DATA_LOOKBACK_HOURS = 24;

// Span metrics prove App Observability is in use, under both supported emitter namings:
// the spanmetrics connector emits traces_spanmetrics_*, OTel/Alloy emits traces_span_metrics_*.
export const SPAN_METRICS_PROBE = `count(last_over_time(traces_spanmetrics_calls_total[${DATA_LOOKBACK_HOURS}h])) or count(last_over_time(traces_span_metrics_calls_total[${DATA_LOOKBACK_HOURS}h]))`;

/**
 * The first probed healthy candidate datasource of `type` where `hasData` confirms data, or null
 * when no candidate confirmed data. Rejects only when listing datasources fails.
 */
export async function probeFound(
  type: string,
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem | null> {
  const candidates = await filterHealthyDatasources(await listProbeCandidates(type, undefined, excludeUids));
  return findDatasourceWithData(candidates, hasData);
}

interface TempoSearchResponse {
  traces?: unknown[];
}

/**
 * One matching trace in the lookback proves data exists. Uses Tempo's search HTTP API via the
 * datasource proxy: the frontend query path misreads streamed empty results as data (observed
 * live with traceQLStreaming) and the resource router 404s Tempo paths on cloud stacks.
 */
export async function tempoHasTraces(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<boolean> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeProxyGet<TempoSearchResponse>(ds.uid, 'api/search', { q: '{}', limit: 1, start, end });
  return Array.isArray(res?.traces) && res.traces.length > 0;
}

// Any series in the lookback means the solution produces data; which datasource holds it is irrelevant.
async function prometheusHasMetric(expr: string): Promise<boolean> {
  const found = await probeFound('prometheus', async (ds) => {
    const frames = await withRetry(() => runInstantQueries({ probe: expr }, ds, PROBE_TIMEOUT_MS));
    return (readScalar(frames, 'probe') ?? 0) > 0;
  });
  return found !== null;
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
  [APP_OBSERVABILITY_APP_ID]: createTtlCachedPromise(() => prometheusHasMetric(SPAN_METRICS_PROBE), PROBE_TTL_MS),
  [HOSTED_TRACES_APP_ID]: createTtlCachedPromise(() => probeFound('tempo', tempoHasTraces).then(Boolean), PROBE_TTL_MS),
  [FRONTEND_OBSERVABILITY_APP_ID]: createTtlCachedPromise(hasFrontendObservabilityData, PROBE_TTL_MS),
};

/**
 * True when the solution already receives data. When the probe cannot answer, unknown fails
 * toward true: hiding a recommendation beats recommending setup for data that may exist.
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

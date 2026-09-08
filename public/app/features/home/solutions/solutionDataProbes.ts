import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrvRequest, config } from '@grafana/runtime';

import {
  createTtlCachedPromise,
  findDatasourceWithData,
  listProbeCandidates,
  probeProxyGet,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
  resolveBackendInstance,
  type TtlCachedPromise,
  withTimeout,
} from './probeUtils';

// "Seen recently" lookback shared by all data probes, tolerating scrape/ingest gaps.
export const DATA_LOOKBACK_HOURS = 24;

// Span metrics prove App Observability is in use, under both supported emitter namings:
// the spanmetrics connector emits traces_spanmetrics_*, OTel/Alloy emits traces_span_metrics_*.
export const SPAN_METRICS_PROBE = `count(last_over_time(traces_spanmetrics_calls_total[${DATA_LOOKBACK_HOURS}h])) or count(last_over_time(traces_span_metrics_calls_total[${DATA_LOOKBACK_HOURS}h]))`;

// Platform telemetry, never the org's product data: excluded unconditionally.
export const CLOUD_UTILITY_PROM_DATASOURCE_UIDS: ReadonlySet<string> = new Set([
  'grafanacloud-usage',
  'grafanacloud-ml-metrics',
]);
export const CLOUD_UTILITY_LOKI_DATASOURCE_UIDS: ReadonlySet<string> = new Set([
  'grafanacloud-usage-insights',
  'grafanacloud-alert-state-history',
]);

/**
 * The first probed healthy candidate datasource of `type` where `hasData` confirms data, or null
 * when no candidate confirmed data. Rejects only when listing datasources fails.
 */
export async function probeFound(
  type: string,
  hasData: (ds: DataSourceInstanceListItem, signal: AbortSignal) => Promise<boolean>,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem | null> {
  return findDatasourceWithData(await listProbeCandidates(type, excludeUids), hasData);
}

const lokiLabelsCache = new Map<string, TtlCachedPromise<string[] | null>>();

/**
 * Loki label names seen in the data lookback (index-only, cheap), or null when the datasource
 * cannot serve resource calls or answers without a list. One request per uid per TTL window: the
 * logs probe and the logs stats read the same list. Failures are expected (dead datasources,
 * 403s) — never toast. `options` carries the probe's abort hook.
 */
export function lokiRecentLabels(
  uid: string,
  options?: Pick<BackendSrvRequest, 'abortSignal'>
): Promise<string[] | null> {
  let cache = lokiLabelsCache.get(uid);
  if (!cache) {
    cache = createTtlCachedPromise(async () => {
      const instance = await resolveBackendInstance(uid);
      if (!instance) {
        return null;
      }
      // Loki label APIs use nanoseconds. This matches LokiDatasource, including its accepted precision loss.
      const end = Date.now() * 1e6;
      const start = end - DATA_LOOKBACK_HOURS * 3600 * 1e9;
      const res = await instance.getResource<{ data?: unknown }>(
        'labels',
        { start, end },
        { showErrorAlert: false, ...options }
      );
      // Loki responds data: null when empty.
      return Array.isArray(res?.data) ? res.data.filter((label): label is string => typeof label === 'string') : null;
    }, PROBE_TTL_MS);
    lokiLabelsCache.set(uid, cache);
  }
  return cache.get();
}

/** Any label in the lookback proves recent data; an empty list is definitive "no data". */
export async function lokiHasRecentLabels(ds: DataSourceInstanceListItem, signal?: AbortSignal): Promise<boolean> {
  const labels = await withTimeout(lokiRecentLabels(ds.uid, { abortSignal: signal }), PROBE_TIMEOUT_MS);
  return labels != null && labels.length > 0;
}

export function resetLokiLabels(): void {
  lokiLabelsCache.clear();
}

// Rule-evaluation output, not ingested telemetry: Prometheus writes these for its own alert
// rules, and Grafana's alert-state export can be the only content of an otherwise empty tenant.
const ALERT_STATE_METRIC_NAMES: ReadonlySet<string> = new Set(['ALERTS', 'ALERTS_FOR_STATE']);

/**
 * True when the datasource saw a recent metric name beyond alert-state series. Same index-only
 * cost as the labels probe, but a tenant holding only exported alert state reads as inactive.
 */
export async function prometheusHasRecentMetrics(
  ds: DataSourceInstanceListItem,
  signal?: AbortSignal
): Promise<boolean> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return false;
  }
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const grafanaAlertMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const excluded = new Set([grafanaAlertMetric, ...ALERT_STATE_METRIC_NAMES]);
  const res = await withTimeout(
    instance.getResource<{ data?: unknown }>(
      'api/v1/label/__name__/values',
      // `limit` (Prometheus ≥2.51, Mimir) caps the payload; one slot per excluded name plus one means
      // a real name always fits. Servers ignoring `limit` return the full list as before.
      { start, end, limit: excluded.size + 1 },
      { showErrorAlert: false, abortSignal: signal }
    ),
    PROBE_TIMEOUT_MS
  );
  return Array.isArray(res?.data) && res.data.some((name) => typeof name === 'string' && !excluded.has(name));
}

interface TempoSearchResponse {
  traces?: unknown[];
}

/**
 * One matching trace in the lookback proves data exists. Uses Tempo's search HTTP API via the
 * datasource proxy: the frontend query path misreads streamed empty results as data (observed
 * live with traceQLStreaming) and the resource router 404s Tempo paths on cloud stacks.
 */
export async function tempoHasTraces(
  ds: Pick<DataSourceInstanceListItem, 'uid'>,
  signal?: AbortSignal
): Promise<boolean> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeProxyGet<TempoSearchResponse>(
    ds.uid,
    'api/search',
    { q: '{}', limit: 1, start, end },
    PROBE_TIMEOUT_MS,
    signal
  );
  return Array.isArray(res?.traces) && res.traces.length > 0;
}

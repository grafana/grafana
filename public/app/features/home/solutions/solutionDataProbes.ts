import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  findDatasourceWithData,
  listProbeCandidates,
  probeProxyGet,
  PROBE_TIMEOUT_MS,
  resolveBackendInstance,
  withDeadline,
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

/**
 * Any label name seen in the lookback proves recent data; an empty list is definitive "no data".
 * Index-only, so cheap even on large tenants. Failures are expected (dead datasources, 403s) — never toast.
 */
export async function lokiHasRecentLabels(ds: DataSourceInstanceListItem, signal?: AbortSignal): Promise<boolean> {
  const res = await withDeadline(PROBE_TIMEOUT_MS, signal, async (s) => {
    const instance = await resolveBackendInstance(ds.uid);
    // The lookup is an ordinary promise: a deadline or abort during it must not issue the request afterwards.
    if (!instance || s.aborted) {
      return null;
    }
    // Loki label APIs use nanoseconds. This matches LokiDatasource, including its accepted precision loss.
    const end = Date.now() * 1e6;
    const start = end - DATA_LOOKBACK_HOURS * 3600 * 1e9;
    return instance.getResource<{ data?: unknown }>(
      'labels',
      { start, end },
      { showErrorAlert: false, abortSignal: s }
    );
  });
  // Loki responds data: null when empty; only string entries count as labels.
  return Array.isArray(res?.data) && res.data.some((label) => typeof label === 'string');
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
  const grafanaAlertMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const excluded = new Set([grafanaAlertMetric, ...ALERT_STATE_METRIC_NAMES]);
  const res = await withDeadline(PROBE_TIMEOUT_MS, signal, async (s) => {
    const instance = await resolveBackendInstance(ds.uid);
    // The lookup is an ordinary promise: a deadline or abort during it must not issue the request afterwards.
    if (!instance || s.aborted) {
      return null;
    }
    const end = Math.floor(Date.now() / 1000);
    const start = end - DATA_LOOKBACK_HOURS * 3600;
    return instance.getResource<{ data?: unknown }>(
      'api/v1/label/__name__/values',
      // `limit` (Prometheus ≥2.51, Mimir) caps the payload; one slot per excluded name plus one means
      // a real name always fits. Servers ignoring `limit` return the full list as before.
      { start, end, limit: excluded.size + 1 },
      { showErrorAlert: false, abortSignal: s }
    );
  });
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

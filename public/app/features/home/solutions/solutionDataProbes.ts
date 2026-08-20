import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  findDatasourceWithData,
  healthyProbeCandidates,
  probeProxyGet,
  PROBE_TIMEOUT_MS,
  resolveBackendInstance,
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
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem | null> {
  return findDatasourceWithData(await healthyProbeCandidates(type, excludeUids), hasData);
}

// Label metadata is a cheap, index-only recency check; empty within the lookback is definitive
// "no data". Failures are expected (dead datasources, 403s) — never toast.
export function labelRecencyProbe(path: string, toEpoch: (ms: number) => number) {
  return async (ds: DataSourceInstanceListItem): Promise<boolean> => {
    const instance = await resolveBackendInstance(ds.uid);
    if (!instance) {
      return false;
    }
    const end = toEpoch(Date.now());
    const start = end - toEpoch(DATA_LOOKBACK_HOURS * 3600 * 1000);
    const res = await withTimeout(
      instance.getResource<{ data?: unknown }>(path, { start, end }, { showErrorAlert: false }),
      PROBE_TIMEOUT_MS
    );
    // Loki responds data: null when empty (and Prometheus data: [] — same emptiness test).
    return Array.isArray(res?.data) && res.data.length > 0;
  };
}

// Rule-evaluation output, not ingested telemetry: Prometheus writes these for its own alert
// rules, and Grafana's alert-state export can be the only content of an otherwise empty tenant.
const ALERT_STATE_METRIC_NAMES: ReadonlySet<string> = new Set(['ALERTS', 'ALERTS_FOR_STATE']);

/**
 * True when the datasource saw a recent metric name beyond alert-state series. Same index-only
 * cost as the labels probe, but a tenant holding only exported alert state reads as inactive.
 */
export async function prometheusHasRecentMetrics(ds: DataSourceInstanceListItem): Promise<boolean> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return false;
  }
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await withTimeout(
    instance.getResource<{ data?: unknown }>('api/v1/label/__name__/values', { start, end }, { showErrorAlert: false }),
    PROBE_TIMEOUT_MS
  );
  const grafanaAlertMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  return (
    Array.isArray(res?.data) &&
    res.data.some(
      (name) => typeof name === 'string' && name !== grafanaAlertMetric && !ALERT_STATE_METRIC_NAMES.has(name)
    )
  );
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

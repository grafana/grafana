import { type DataSourceInstanceListItem, type DataSourceInstanceSettings, type FieldSparkline } from '@grafana/data';

import { probeResourceGet, PROBE_TIMEOUT_MS } from './probeUtils';
import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';
import { CLOUD_UTILITY_PROM_DATASOURCE_UIDS, DATA_LOOKBACK_HOURS, probeFound } from './solutionDataProbes';

export interface AppObservabilityStats {
  /** Jobs in the plugin's service inventory: resource metadata seen over its default 30m range. */
  services: number | null;
  /** Fleet error ratio over server-side spans in the last hour. */
  errorRatio: number | null;
}

// Span metrics prove App Observability is in use; one entry per emitter naming the plugin
// supports: Tempo metrics-generator/Beyla, OTel collector >=0.109, older collectors.
const SPAN_METRICS_CALL_NAMES: readonly string[] = [
  'traces_spanmetrics_calls_total',
  'traces_span_metrics_calls_total',
  'calls_total',
];

// The plugin's own service-inventory selector; reduces false positives from unrelated
// counters sharing the bare calls_total name.
const APP_SPAN_KINDS = 'span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"';

// One matcher list covers every naming family. Only valid where __name__ survives (instant
// selectors, the series index); rate() drops it and would collide the families.
const ANY_SPAN_METRIC = `__name__=~"${SPAN_METRICS_CALL_NAMES.join('|')}",${APP_SPAN_KINDS}`;

// The plugin's inventory is keyed off resource metadata, not span metrics: `traces_target_info`
// from Tempo's metrics-generator, `target_info` from an OTel pipeline. Its default range is 30m.
const TARGET_INFO_NAMES: readonly string[] = ['traces_target_info', 'target_info'];
const INVENTORY_WINDOW = '30m';

// The app's "server-side" definition: SERVER plus CONSUMER, so message-queue consumers count
// as request handlers.
const SERVER_SIDE = 'span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"';

// Span metrics are the widest family on a tenant, so their rate window stays short: a 24h range
// vector over them was the slowest query the homepage issued.
const ERROR_RATIO_WINDOW = '1h';

// Additive `or` union across the call-name families: rate() drops __name__, so without the
// synthetic __family__ tag an identically-labeled stopped family would shadow its successor
// for a whole rate window and could split the error ratio across families. Ingestion rejects
// __-prefixed labels, so the tag cannot collide; a pipeline genuinely dual-emitting counts twice.
const overCallFamilies = (expr: (metric: string) => string) =>
  SPAN_METRICS_CALL_NAMES.map((m, i) => `label_replace(${expr(m)}, "__family__", "${i}", "", "")`).join(' or ');

// services: the plugin's inventory. Span metrics only classify those jobs there, so counting them
// instead would drop idle and metrics-only services. job=~".+" excludes jobless series that would
// otherwise read as one phantom service.
// errorRatio: `or vector(0)` keeps an error-free fleet at 0% while a failed query reads null.
const STATS_QUERIES: Record<string, string> = {
  services: `count(${TARGET_INFO_NAMES.map((m) => `count by (job) (last_over_time(${m}{job=~".+"}[${INVENTORY_WINDOW}]))`).join(' or ')})`,
  errorRatio: `(sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE},status_code="STATUS_CODE_ERROR"}[${ERROR_RATIO_WINDOW}])`)}) or vector(0)) / sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE}}[${ERROR_RATIO_WINDOW}])`)})`,
};

/**
 * Index-only, like the metrics probe: a series selector on the label-values API proves recent span
 * metrics without reading chunks. Checking the returned names keeps the answer right on a server
 * that ignores `match[]`; the list is merely longer there.
 */
async function prometheusHasSpanMetrics(ds: DataSourceInstanceListItem, signal?: AbortSignal): Promise<boolean> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeResourceGet<{ data?: unknown }>(
    ds.uid,
    'api/v1/label/__name__/values',
    { start, end, limit: 1, 'match[]': `{${ANY_SPAN_METRIC}}` },
    PROBE_TIMEOUT_MS,
    signal
  );
  return (
    Array.isArray(res?.data) &&
    res.data.some((name) => typeof name === 'string' && SPAN_METRICS_CALL_NAMES.includes(name))
  );
}

/** Resolved Prometheus datasource with span metrics, or null when none. */
export function probeSpanMetrics(): Promise<DataSourceInstanceListItem | null> {
  return probeFound('prometheus', prometheusHasSpanMetrics, CLOUD_UTILITY_PROM_DATASOURCE_UIDS);
}

/** Inventory service count and last-hour fleet error ratio. */
export async function fetchAppObservabilityStats(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<AppObservabilityStats> {
  // partial: readers are null-safe; one failed query keeps the rest.
  const frames = await runInstantQueries(STATS_QUERIES, ds, { partial: true });
  return {
    services: readScalar(frames, 'services'),
    errorRatio: readScalar(frames, 'errorRatio'),
  };
}

/** Server-side request-rate sparkline; null when the span metrics are absent. */
export async function fetchAppObservabilityRequestSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'requests',
    // $__rate_interval (at least four scrape intervals and one step): each point averages its whole
    // step, as the plugin's RED panels do.
    `sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE}}[$__rate_interval])`)})`,
    24,
    ds
  );
  return readSeries(frames, 'requests');
}

import { type DataSourceInstanceListItem, type DataSourceInstanceSettings, type FieldSparkline } from '@grafana/data';

import { PROBE_TIMEOUT_MS } from './probeUtils';
import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';
import {
  CLOUD_UTILITY_PROM_DATASOURCE_UIDS,
  DATA_LOOKBACK_HOURS,
  probeFound,
  SPAN_METRICS_PROBE,
} from './solutionDataProbes';

export interface AppObservabilityStats {
  services: number | null;
  /** 24h fleet error ratio over server spans. */
  errorRatio: number | null;
}

// "Seen recently" lookback matching the shared data probes.
const LOOKBACK = `${DATA_LOOKBACK_HOURS}h`;

// Span metrics arrive under two emitter namings (see SPAN_METRICS_PROBE): the spanmetrics
// connector emits traces_spanmetrics_* with a `service` label, OTel/Alloy emits
// traces_span_metrics_* with `service_name`. Every query unions both families with `or`; a
// service dual-emitting both namings during a pipeline migration counts twice — accepted.
//
// errorRatio counts server spans only so client/internal spans don't multiply one request,
// matching the trace-based alerting guidance. `or vector(0)` on the numerator keeps an
// error-free fleet at 0% while a failed query still reads null.
const STATS_QUERIES: Record<string, string> = {
  services: `count(count by (service, service_name) (last_over_time(traces_spanmetrics_calls_total[${LOOKBACK}]) or last_over_time(traces_span_metrics_calls_total[${LOOKBACK}])))`,
  errorRatio: `(sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[${LOOKBACK}]) or rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[${LOOKBACK}])) or vector(0)) / sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[${LOOKBACK}]) or rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER"}[${LOOKBACK}]))`,
};

// Single attempt inside the probe timeout; errors read as no data in the parallel scan.
async function prometheusHasSpanMetrics(ds: DataSourceInstanceListItem): Promise<boolean> {
  const frames = await runInstantQueries({ probe: SPAN_METRICS_PROBE }, ds, PROBE_TIMEOUT_MS);
  return (readScalar(frames, 'probe') ?? 0) > 0;
}

/** Resolved Prometheus datasource with span metrics, or null when none. */
export function probeSpanMetrics(): Promise<DataSourceInstanceListItem | null> {
  return probeFound('prometheus', prometheusHasSpanMetrics, CLOUD_UTILITY_PROM_DATASOURCE_UIDS);
}

/** Instrumented service count and fleet error ratio over the stats lookback. */
export async function fetchAppObservabilityStats(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<AppObservabilityStats> {
  // partial: readers are null-safe; one failed query keeps the rest.
  const frames = await runInstantQueries(STATS_QUERIES, ds, undefined, true);
  return {
    services: readScalar(frames, 'services'),
    errorRatio: readScalar(frames, 'errorRatio'),
  };
}

/** Server-span request rate over 24h; null when the span metrics are absent. */
export async function fetchAppObservabilityRequestSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'requests',
    // [5m] rate window: span metrics are scrape-cadence series, so the synthetics-style
    // window widening is unnecessary.
    'sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]) or rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]))',
    24,
    ds
  );
  return readSeries(frames, 'requests');
}

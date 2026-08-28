import { type DataSourceInstanceListItem, type DataSourceInstanceSettings, type FieldSparkline } from '@grafana/data';

import { PROBE_TIMEOUT_MS } from './probeUtils';
import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';
import {
  APP_SPAN_KINDS,
  CLOUD_UTILITY_PROM_DATASOURCE_UIDS,
  DATA_LOOKBACK_HOURS,
  probeFound,
  SPAN_METRICS_CALL_NAMES,
  SPAN_METRICS_PROBE,
} from './solutionDataProbes';

export interface AppObservabilityStats {
  services: number | null;
  /** 24h fleet error ratio over server-side (SERVER|CONSUMER) spans. */
  errorRatio: number | null;
}

// "Seen recently" lookback matching the shared data probes.
const LOOKBACK = `${DATA_LOOKBACK_HOURS}h`;

// Server-side traffic per the app's own definition (its makeRedLabels): SERVER plus CONSUMER,
// so message-queue consumers count as request handlers.
const SERVER_SIDE = 'span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"';

// Left-biased series union of the three emitter namings (see SPAN_METRICS_CALL_NAMES).
// `or` does not deduplicate: the job-keyed count collapses dual-emitting pipelines, while the
// fleet sums below can briefly inflate during a naming migration — accepted.
const overCallFamilies = (expr: (metric: string) => string) => SPAN_METRICS_CALL_NAMES.map(expr).join(' or ');

// services counts instrumented jobs with span metrics in the lookback, keyed by `job` like the
// app's Services inventory. job=~".+" keeps unidentifiable (jobless) series from reading as one
// phantom service; they still count as traffic in the fleet sums below, which need no identity.
// errorRatio: `or vector(0)` keeps an error-free fleet at 0% while a failed query reads null.
const STATS_QUERIES: Record<string, string> = {
  services: `count(count by (job) (${overCallFamilies((m) => `last_over_time(${m}{job=~".+",${APP_SPAN_KINDS}}[${LOOKBACK}])`)}))`,
  errorRatio: `(sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE},status_code="STATUS_CODE_ERROR"}[${LOOKBACK}])`)}) or vector(0)) / sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE}}[${LOOKBACK}])`)})`,
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

/** Server-side request rate over 24h; null when the span metrics are absent. */
export async function fetchAppObservabilityRequestSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'requests',
    // [5m] rate window: span metrics are scrape-cadence series, so the synthetics-style
    // window widening is unnecessary.
    `sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE}}[5m])`)})`,
    24,
    ds
  );
  return readSeries(frames, 'requests');
}

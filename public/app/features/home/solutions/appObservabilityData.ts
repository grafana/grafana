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
  /** Fleet error ratio over server-side spans within the stats lookback. */
  errorRatio: number | null;
}

// "Seen recently" lookback matching the shared data probes.
const LOOKBACK = `${DATA_LOOKBACK_HOURS}h`;

// The app's "server-side" definition: SERVER plus CONSUMER, so message-queue consumers count
// as request handlers.
const SERVER_SIDE = 'span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"';

// Additive `or` union across the call-name families: rate() drops __name__, so without the
// synthetic __family__ tag an identically-labeled stopped family would shadow its successor
// for a whole rate window and could split the error ratio across families. Ingestion rejects
// __-prefixed labels, so the tag cannot collide; a pipeline genuinely dual-emitting counts twice.
const overCallFamilies = (expr: (metric: string) => string) =>
  SPAN_METRICS_CALL_NAMES.map((m, i) => `label_replace(${expr(m)}, "__family__", "${i}", "", "")`).join(' or ');

// services: jobs with recent span metrics, keyed by `job` like the app's inventory; job=~".+"
// excludes jobless series that would otherwise read as one phantom service.
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

/** Server-side request-rate sparkline; null when the span metrics are absent. */
export async function fetchAppObservabilityRequestSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'requests',
    // [5m] rate window: span metrics arrive at scrape cadence, so no wide window is needed.
    `sum(${overCallFamilies((m) => `rate(${m}{${SERVER_SIDE}}[5m])`)})`,
    24,
    ds
  );
  return readSeries(frames, 'requests');
}

import { getAPINamespace } from '@grafana/api-clients';
import {
  type DataSourceInstanceListItem,
  type Field,
  type FieldSparkline,
  FieldType,
  getMinMaxAndDelta,
} from '@grafana/data';
import { type DataSourceWithBackend, isFetchError } from '@grafana/runtime';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { PromApplication } from 'app/types/unified-alerting-dto';

import { probeProxyGet, resolveBackendInstance, withTimeout } from './probeUtils';
import { readLabeledScalar, readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';
import { DATA_LOOKBACK_HOURS } from './solutionDataProbes';

/** Stats window for the logs card (design-fixed), distinct from the 24h sparkline lookback. */
export const LOGS_STATS_LOOKBACK_DAYS = 7;

/** Stats window for the metric-name fallback count (design-fixed), distinct from the 24h lookback. */
export const METRICS_STATS_LOOKBACK_DAYS = 7;

const NS_IN_MS = 1e6;
const NS_IN_S = 1e9;

// Card details load after placement and only hold their own skeleton, so they get a larger
// budget than the placement-gating probes: a cold TraceQL-metrics scan on a busy tenant
// takes well over 10s, and the disk-pressure alert query can be similarly slow.
const DETAIL_QUERY_TIMEOUT_MS = 30_000;

export interface LogsActivity {
  bytes: number | null;
  sources: number | null;
  series: FieldSparkline | null;
}

export interface TracesActivity {
  spans: number | null;
  series: FieldSparkline | null;
  lookbackHours: number;
}

interface LokiVolumeResponse {
  data?: { result?: Array<{ value?: [number, string] }> };
}

interface LokiVolumeRangeResponse {
  data?: { result?: Array<{ values?: Array<[number, string]> }> };
}

interface TempoTagValuesResponse {
  tagValues?: Array<{ value?: string }>;
}

// Failures are expected (endpoint disabled, 403s) and handled by the caller; never toast.
function getResource<T>(instance: DataSourceWithBackend, path: string, params: Record<string, unknown>): Promise<T> {
  return withTimeout(instance.getResource<T>(path, params, { showErrorAlert: false }), DETAIL_QUERY_TIMEOUT_MS);
}

// Points are [unix ms, value]; a real trend needs at least two of them.
function toSparkline(points: Array<[number, number]>, name: string): FieldSparkline | null {
  if (points.length < 2) {
    return null;
  }
  points.sort(([a], [b]) => a - b);
  const x: Field = { name: 'Time', type: FieldType.time, values: points.map(([ts]) => ts), config: {} };
  const y: Field = { name, type: FieldType.number, values: points.map(([, value]) => value), config: {} };
  return { x, y: { ...y, state: { range: getMinMaxAndDelta(y) } } };
}

// Loki rejects matcher-less queries. service_name/job cover conventional setups; otherwise
// best effort — streams missing the fallback label drop out of the totals.
async function resolveLogsLabel(instance: DataSourceWithBackend, start: number, end: number): Promise<string | null> {
  const res = await getResource<{ data?: unknown }>(instance, 'labels', { start, end });
  const labels = Array.isArray(res?.data)
    ? res.data.filter((label): label is string => typeof label === 'string' && !label.startsWith('__'))
    : [];
  return ['service_name', 'job'].find((preferred) => labels.includes(preferred)) ?? labels[0] ?? null;
}

/**
 * Ingested bytes and distinct sources over the stats window plus the 24h ingest-volume
 * sparkline, all riding Loki's index (cheap even over 7d). Each field fails soft to null.
 */
export async function fetchLogsActivity(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<LogsActivity> {
  const empty: LogsActivity = { bytes: null, sources: null, series: null };
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return empty;
  }
  const end = Date.now() * NS_IN_MS;
  const statsStart = end - LOGS_STATS_LOOKBACK_DAYS * 24 * 3600 * NS_IN_S;
  const label = await resolveLogsLabel(instance, statsStart, end).catch(() => null);
  if (!label) {
    return empty;
  }
  const query = `{${label}=~".+"}`;
  // aggregateBy=labels totals by label NAME, not value — one series; Loki's series limit cannot truncate it.
  const aggregate = { aggregateBy: 'labels', targetLabels: label };
  const [volume, values, volumeRange] = await Promise.all([
    getResource<LokiVolumeResponse>(instance, 'index/volume', { query, start: statsStart, end, ...aggregate }).catch(
      () => null
    ),
    getResource<{ data?: unknown }>(instance, `label/${encodeURIComponent(label)}/values`, {
      start: statsStart,
      end,
    }).catch(() => null),
    getResource<LokiVolumeRangeResponse>(instance, 'index/volume_range', {
      query,
      start: end - DATA_LOOKBACK_HOURS * 3600 * NS_IN_S,
      end,
      step: '30m',
      ...aggregate,
    }).catch(() => null),
  ]);
  const volumes = volume?.data?.result;
  // Sum the (single-series) matrix into ingest buckets (timestamps are unix seconds).
  const buckets = new Map<number, number>();
  for (const series of volumeRange?.data?.result ?? []) {
    for (const [ts, value] of series.values ?? []) {
      buckets.set(ts * 1000, (buckets.get(ts * 1000) ?? 0) + (Number(value) || 0));
    }
  }
  return {
    bytes:
      Array.isArray(volumes) && volumes.length > 0
        ? volumes.reduce((total, entry) => total + (Number(entry.value?.[1]) || 0), 0)
        : null,
    sources: Array.isArray(values?.data) ? values.data.length : null,
    series: toSparkline([...buckets.entries()], 'Ingest volume'),
  };
}

/**
 * Distinct services seen by Tempo in the lookback, or null when the response is unusable;
 * rejections propagate (callers fail soft). Uses the datasource proxy: Tempo's resource router
 * 404s these paths on cloud stacks.
 */
export async function fetchTracesServices(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<number | null> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeProxyGet<TempoTagValuesResponse>(
    ds.uid,
    'api/v2/search/tag/resource.service.name/values',
    { start, end },
    DETAIL_QUERY_TIMEOUT_MS
  );
  return Array.isArray(res?.tagValues) ? res.tagValues.length : null;
}

interface TempoQueryRangeResponse {
  series?: Array<{ samples?: Array<{ timestampMs?: string | number; value?: number }> }>;
}

const TEMPO_V2_METRICS_LOOKBACK_HOURS = 3;
const TEMPO_V2_METRICS_DURATION_ERROR = 'maximum allowed duration of 3h0m0s';

function isTempoV2MetricsDurationError(error: unknown): boolean {
  if (!isFetchError(error) || error.status !== 400) {
    return false;
  }

  const message = typeof error.data === 'string' ? error.data : error.data?.message;
  return typeof message === 'string' && message.includes(TEMPO_V2_METRICS_DURATION_ERROR);
}

function queryTracesActivity(dsUid: string, end: number, lookbackHours: number): Promise<TempoQueryRangeResponse> {
  return probeProxyGet<TempoQueryRangeResponse>(
    dsUid,
    'api/metrics/query_range',
    {
      q: '{} | count_over_time()',
      start: end - lookbackHours * 3600,
      end,
      step: '30m',
    },
    DETAIL_QUERY_TIMEOUT_MS
  );
}

/**
 * Span throughput over the last 24h via Tempo's TraceQL-metrics HTTP API, falling back to the
 * Tempo 2.x three-hour maximum. The summed series feeds the sparkline, its integral is the span
 * count. Datasource proxy on purpose — the frontend query path rebuilds raw targets on some
 * plugin versions. Needs the metrics-generator; callers fail soft on rejection.
 */
export async function fetchTracesActivity(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<TracesActivity> {
  const end = Math.floor(Date.now() / 1000);
  let lookbackHours = DATA_LOOKBACK_HOURS;
  let res: TempoQueryRangeResponse;
  try {
    res = await queryTracesActivity(ds.uid, end, lookbackHours);
  } catch (error) {
    if (!isTempoV2MetricsDurationError(error)) {
      throw error;
    }
    // Tempo 2.x defaults TraceQL metrics queries to a three-hour maximum.
    lookbackHours = TEMPO_V2_METRICS_LOOKBACK_HOURS;
    res = await queryTracesActivity(ds.uid, end, lookbackHours);
  }
  const buckets = new Map<number, number>();
  for (const series of res?.series ?? []) {
    for (const sample of series.samples ?? []) {
      // Sparse samples: zero buckets may be omitted; values may arrive as strings.
      const ts = Number(sample.timestampMs);
      const value = Number(sample.value ?? 0);
      if (Number.isFinite(ts) && Number.isFinite(value)) {
        buckets.set(ts, (buckets.get(ts) ?? 0) + value);
      }
    }
  }
  return {
    spans: buckets.size > 0 ? [...buckets.values()].reduce((total, value) => total + value, 0) : null,
    series: toSparkline([...buckets.entries()], 'Span throughput'),
    lookbackHours,
  };
}

export interface MetricsDiskPressure {
  /** Hosts whose fullest filesystem exceeds the pressure threshold. */
  hostsAbove: number;
  worstInstance: string | null;
  worstMount: string | null;
  /** 0..1 fill ratio of the worst host. */
  worstRatio: number | null;
}

export interface MetricsActivity {
  /** Active series (cardinality API / TSDB head stats). */
  series: number | null;
  /** Ingest rate (stack-scoped usage metrics, else Prometheus self-monitoring). */
  dataPointsPerMinute: number | null;
  /** Distinct metric names over the stats window (fallback primary). */
  names: number | null;
  /** node_exporter host count. */
  hosts: number | null;
  /** Active-series trend over the last 24h. */
  seriesSparkline: FieldSparkline | null;
}

// Threshold and ETA clamp for the disk-pressure alert row (design/judgment constants).
const DISK_PRESSURE_RATIO = 0.9;
const DISK_ETA_MAX_HOURS = 48;

const FS_EXCLUDE = 'fstype!~"tmpfs|overlay|squashfs|iso9660|ramfs"';
// Per-filesystem fill ratio; pseudo filesystems excluded.
const FS_USED = `(1 - node_filesystem_avail_bytes{${FS_EXCLUDE}} / node_filesystem_size_bytes{${FS_EXCLUDE}})`;
/** Counts hosts whose fullest real filesystem exceeds the card threshold. */
export const METRICS_DISK_PRESSURE_QUERY = `max by (instance) (${FS_USED}) > ${DISK_PRESSURE_RATIO}`;

// Active series, cloud-first: Mimir's cardinality API, then vanilla Prometheus TSDB head stats.
// Both absent/broken → null and the metric-name count carries the card instead.
async function fetchActiveSeries(instance: DataSourceWithBackend): Promise<number | null> {
  const cardinality = await getResource<{ series_count_total?: unknown }>(instance, 'api/v1/cardinality/label_values', {
    'label_names[]': '__name__',
    // Mimir defaults count_method to inmemory, which also counts stale series held in open TSDB heads.
    count_method: 'active',
  })
    .then((res) => Number(res?.series_count_total))
    .catch(() => null);
  if (cardinality != null && Number.isFinite(cardinality) && cardinality > 0) {
    return cardinality;
  }
  const headSeries = await getResource<{ data?: { headStats?: { numSeries?: unknown } } }>(
    instance,
    'api/v1/status/tsdb',
    {}
  )
    .then((res) => Number(res?.data?.headStats?.numSeries))
    .catch(() => null);
  return headSeries != null && Number.isFinite(headSeries) && headSeries > 0 ? headSeries : null;
}

// Linear ETA until the shown (fullest) filesystem fills. Growing/steady filesystems drop
// out via `> 0`; past the clamp a linear estimate is noise.
export async function fetchMetricsDiskHoursToFull(
  instanceLabel: string,
  mountpoint: string,
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>
): Promise<number | null> {
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const selector = `{instance="${esc(instanceLabel)}",mountpoint="${esc(mountpoint)}",${FS_EXCLUDE}}`;
  const hours = await runInstantQueries(
    {
      eta: `min((node_filesystem_avail_bytes${selector} / -deriv(node_filesystem_avail_bytes${selector}[6h])) > 0) / 3600`,
    },
    ds,
    DETAIL_QUERY_TIMEOUT_MS
  )
    .then((frames) => readScalar(frames, 'eta'))
    .catch(() => null);
  return hours != null && hours > 0 && hours <= DISK_ETA_MAX_HOURS ? hours : null;
}

export async function fetchMetricsDiskPressure(
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>
): Promise<MetricsDiskPressure | null> {
  const frames = await runInstantQueries(
    {
      diskHosts: `count(${METRICS_DISK_PRESSURE_QUERY})`,
      diskWorst: `topk(1, ${FS_USED})`,
    },
    ds,
    DETAIL_QUERY_TIMEOUT_MS,
    true
  ).catch(() => null);
  if (!frames) {
    return null;
  }

  // Empty diskHosts vector (nobody above threshold) reads as null — zero here.
  const hostsAbove = readScalar(frames, 'diskHosts') ?? 0;
  if (hostsAbove < 1) {
    return null;
  }

  const worst = readLabeledScalar(frames, 'diskWorst', 'instance');
  const worstMount = readLabeledScalar(frames, 'diskWorst', 'mountpoint')?.label ?? null;
  const worstInstance = worst?.label ?? null;
  return {
    hostsAbove,
    worstInstance,
    worstMount,
    worstRatio: worst?.value ?? null,
  };
}

// prometheus_tsdb_head_series is a Prometheus self-monitoring metric. On multi-tenant
// remote-write backends (Mimir/Cortex — every Grafana Cloud hosted datasource) any such
// series was ingested from other Prometheus servers, so the trend would chart a foreign
// population; skip rather than mislabel it. Vanilla/untyped datasources keep the query.
async function isMimirOrCortex(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<boolean> {
  const jsonData = (await getDataSourceInstanceSettings(ds.uid))?.jsonData;
  const promType = jsonData && 'prometheusType' in jsonData ? jsonData.prometheusType : undefined;
  return promType === PromApplication.Mimir || promType === PromApplication.Cortex;
}

async function fetchSeriesSparkline(
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>,
  mimir: boolean
): Promise<FieldSparkline | null> {
  if (mimir) {
    return null;
  }
  return runRangeQuery('series', 'sum(prometheus_tsdb_head_series)', DATA_LOOKBACK_HOURS, ds)
    .then((frames) => readSeries(frames, 'series'))
    .catch(() => null);
}

const CLOUD_USAGE_DATASOURCE_UID = 'grafanacloud-usage';
// Same self-monitoring trust story as prometheus_tsdb_head_series: skip on Mimir/Cortex.
const PROM_DPM_QUERY = '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))';

interface UsageQueries {
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>;
  activeSeries: string;
  dataPointsPerMinute: string;
}

/**
 * Stack-scoped usage queries when this Grafana is a Cloud stack with the usage datasource;
 * never query the shared usage datasource without a stack scope.
 */
async function resolveUsageQueries(): Promise<UsageQueries | null> {
  const namespace = getAPINamespace();
  const stackId = namespace.startsWith('stacks-') ? namespace.slice('stacks-'.length) : '';
  if (!stackId) {
    return null;
  }
  const usage = await getDataSourceInstanceSettings(CLOUD_USAGE_DATASOURCE_UID);
  if (!usage || usage.type !== 'prometheus') {
    return null;
  }
  return {
    ds: { uid: usage.uid, type: usage.type },
    // max by (id) dedupes HA-duplicate usage series before the stack-wide sum.
    activeSeries: `sum(max by (id) (grafanacloud_instance_active_series{stack_id="${stackId}"}))`,
    dataPointsPerMinute: `60 * sum(max by (id) (grafanacloud_instance_samples_per_second{stack_id="${stackId}"}))`,
  };
}

/**
 * Active-series count, metric-name count, node_exporter host count, and the 24h active-series
 * sparkline. Every field fails soft to null; the card drops when nothing renderable remains.
 * Never a matcher-less series query — cardinality on large tenants is prohibitive.
 */
export async function fetchMetricsActivity(
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>
): Promise<MetricsActivity> {
  const empty: MetricsActivity = {
    series: null,
    dataPointsPerMinute: null,
    names: null,
    hosts: null,
    seriesSparkline: null,
  };
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return empty;
  }
  const [usage, mimir] = await Promise.all([resolveUsageQueries(), isMimirOrCortex(ds)]);
  // Prometheus resource calls take epoch seconds (unlike Loki's nanoseconds above).
  const end = Math.floor(Date.now() / 1000);
  const start = end - METRICS_STATS_LOOKBACK_DAYS * 24 * 3600;
  const [series, names, seriesSparkline, healthFrames, usageStats] = await Promise.all([
    fetchActiveSeries(instance),
    getResource<{ data?: unknown }>(instance, 'api/v1/label/__name__/values', { start, end })
      .then((res) => (Array.isArray(res?.data) ? res.data.length : null))
      .catch(() => null),
    usage
      ? runRangeQuery('series', usage.activeSeries, DATA_LOOKBACK_HOURS, usage.ds)
          .then((frames) => readSeries(frames, 'series'))
          .catch(() => null)
          // Zero-ingestion stacks have no usage series; chain the counts' self-monitoring fallback.
          .then((sparkline) => sparkline ?? fetchSeriesSparkline(ds, mimir))
      : fetchSeriesSparkline(ds, mimir),
    runInstantQueries(
      {
        ...(mimir ? {} : { dpm: PROM_DPM_QUERY }),
        hosts: 'count(node_uname_info)',
      },
      ds,
      undefined,
      // partial: readers are null-safe; one failed query keeps the rest.
      true
    ).catch(() => null),
    usage
      ? runInstantQueries(
          { activeSeries: usage.activeSeries, dataPointsPerMinute: usage.dataPointsPerMinute },
          usage.ds,
          undefined,
          // partial: readers are null-safe; one failed query keeps the rest.
          true
        )
          .then((frames) => ({
            series: readScalar(frames, 'activeSeries'),
            dpm: readScalar(frames, 'dataPointsPerMinute'),
          }))
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const usageSeries = usageStats?.series != null && usageStats.series > 0 ? usageStats.series : null;
  const promDpm = healthFrames ? readScalar(healthFrames, 'dpm') : null;
  const usageDpm = usageStats?.dpm != null && usageStats.dpm > 0 ? usageStats.dpm : null;
  const dataPointsPerMinute = usageDpm ?? (promDpm != null && promDpm > 0 ? promDpm : null);
  const hosts = healthFrames ? readScalar(healthFrames, 'hosts') : null;
  return { series: usageSeries ?? series, dataPointsPerMinute, names, hosts, seriesSparkline };
}

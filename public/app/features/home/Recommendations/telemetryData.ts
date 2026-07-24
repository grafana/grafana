import {
  type DataQuery,
  type DataSourceInstanceListItem,
  dateTime,
  type Field,
  type FieldSparkline,
  FieldType,
  getMinMaxAndDelta,
  type TimeRange,
} from '@grafana/data';
import { type DataSourceWithBackend } from '@grafana/runtime';

import { PROBE_TIMEOUT_MS, resolveBackendInstance, withRetry, withTimeout } from './probeUtils';
import { readSeries, runDatasourceQueries } from './promQuery';
import { DATA_LOOKBACK_HOURS } from './solutionDataProbes';

/** Stats window for the logs card (design-fixed), distinct from the 24h sparkline lookback. */
export const LOGS_STATS_LOOKBACK_DAYS = 7;

const NS_IN_MS = 1e6;
const NS_IN_S = 1e9;

export interface LogsStats {
  bytes: number | null;
  sources: number | null;
}

export interface TracesActivity {
  spans: number | null;
  series: FieldSparkline | null;
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

function getResource<T>(instance: DataSourceWithBackend, path: string, params: Record<string, unknown>): Promise<T> {
  return withRetry(() => withTimeout(instance.getResource<T>(path, params), PROBE_TIMEOUT_MS));
}

// Loki rejects matcher-less queries; pick the label the org's streams actually carry.
async function resolveLogsLabel(instance: DataSourceWithBackend, start: number, end: number): Promise<string | null> {
  const res = await getResource<{ data?: unknown }>(instance, 'labels', { start, end });
  const labels = Array.isArray(res?.data)
    ? res.data.filter((label): label is string => typeof label === 'string' && !label.startsWith('__'))
    : [];
  return ['service_name', 'job'].find((preferred) => labels.includes(preferred)) ?? labels[0] ?? null;
}

/** Ingested bytes and distinct sources over the stats window; null fields when unavailable. */
export async function fetchLogsStats(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<LogsStats> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return { bytes: null, sources: null };
  }
  const end = Date.now() * NS_IN_MS;
  const start = end - LOGS_STATS_LOOKBACK_DAYS * 24 * 3600 * NS_IN_S;
  const label = await resolveLogsLabel(instance, start, end);
  if (!label) {
    return { bytes: null, sources: null };
  }
  // Volume rides the index (cheap even over 7d); a disabled volume endpoint fails soft to null.
  const [volume, values] = await Promise.all([
    getResource<LokiVolumeResponse>(instance, 'index/volume', {
      query: `{${label}=~".+"}`,
      start,
      end,
      limit: 1000,
    }).catch(() => null),
    getResource<{ data?: unknown }>(instance, `label/${encodeURIComponent(label)}/values`, { start, end }).catch(
      () => null
    ),
  ]);
  const volumes = volume?.data?.result;
  const bytes = Array.isArray(volumes)
    ? volumes.reduce((total, entry) => total + (Number(entry.value?.[1]) || 0), 0)
    : null;
  const sources = Array.isArray(values?.data) ? values.data.length : null;
  return { bytes, sources };
}

/** Ingest-volume sparkline over the last 24h, or null when the series cannot be built. */
export async function fetchLogsVolumeSeries(
  ds: Pick<DataSourceInstanceListItem, 'uid'>
): Promise<FieldSparkline | null> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return null;
  }
  const end = Date.now() * NS_IN_MS;
  const start = end - DATA_LOOKBACK_HOURS * 3600 * NS_IN_S;
  const label = await resolveLogsLabel(instance, start, end);
  if (!label) {
    return null;
  }
  const res = await getResource<LokiVolumeRangeResponse>(instance, 'index/volume_range', {
    query: `{${label}=~".+"}`,
    start,
    end,
    step: '30m',
  });
  // Sum the per-label matrix into one total-ingest series (timestamps are unix seconds).
  const buckets = new Map<number, number>();
  for (const series of res?.data?.result ?? []) {
    for (const [ts, value] of series.values ?? []) {
      buckets.set(ts, (buckets.get(ts) ?? 0) + (Number(value) || 0));
    }
  }
  const points = [...buckets.entries()].sort(([a], [b]) => a - b);
  if (points.length < 2) {
    return null;
  }
  const x: Field = { name: 'Time', type: FieldType.time, values: points.map(([ts]) => ts * 1000), config: {} };
  const y: Field = { name: 'Ingest volume', type: FieldType.number, values: points.map(([, v]) => v), config: {} };
  return { x, y: { ...y, state: { range: getMinMaxAndDelta(y) } } };
}

/** Distinct services seen by Tempo in the lookback, or null when the lookup fails. */
export async function fetchTracesServices(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<number | null> {
  const instance = await resolveBackendInstance(ds.uid);
  if (!instance) {
    return null;
  }
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await getResource<TempoTagValuesResponse>(instance, 'api/v2/search/tag/resource.service.name/values', {
    start,
    end,
  });
  return Array.isArray(res?.tagValues) ? res.tagValues.length : null;
}

interface TempoMetricsQuery extends DataQuery {
  query: string;
  metricsQueryType: 'range';
}

/**
 * Span throughput over the last 24h via TraceQL metrics: the summed series feeds the sparkline,
 * its integral is the span count. Needs the metrics-generator; callers fail soft on rejection.
 */
export async function fetchTracesActivity(
  ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>
): Promise<TracesActivity> {
  const toTime = dateTime();
  const fromTime = dateTime().subtract(DATA_LOOKBACK_HOURS, 'h');
  const range: TimeRange = {
    from: fromTime,
    to: toTime,
    raw: { from: `now-${DATA_LOOKBACK_HOURS}h`, to: 'now' },
  };
  const target: TempoMetricsQuery = {
    refId: 'spans',
    queryType: 'traceql',
    query: '{} | count_over_time()',
    metricsQueryType: 'range',
  };
  const frames = await withRetry(() => runDatasourceQueries([target], range, ds));
  const series = readSeries(frames, 'spans');
  let spans = 0;
  let seen = false;
  for (const frame of frames) {
    if (frame.refId !== 'spans') {
      continue;
    }
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      for (const value of field.values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          seen = true;
          spans += value;
        }
      }
    }
  }
  return { spans: seen ? spans : null, series };
}

import {
  type DataSourceInstanceListItem,
  type Field,
  type FieldSparkline,
  FieldType,
  getMinMaxAndDelta,
} from '@grafana/data';
import { type DataSourceWithBackend } from '@grafana/runtime';

import { probeProxyGet, PROBE_TIMEOUT_MS, resolveBackendInstance, withRetry, withTimeout } from './probeUtils';
import { DATA_LOOKBACK_HOURS } from './solutionDataProbes';

/** Stats window for the logs card (design-fixed), distinct from the 24h sparkline lookback. */
export const LOGS_STATS_LOOKBACK_DAYS = 7;

const NS_IN_MS = 1e6;
const NS_IN_S = 1e9;

export interface LogsActivity {
  bytes: number | null;
  sources: number | null;
  series: FieldSparkline | null;
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

// Loki rejects matcher-less queries; pick the label the org's streams actually carry.
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
  const label = await resolveLogsLabel(instance, statsStart, end);
  if (!label) {
    return empty;
  }
  const query = `{${label}=~".+"}`;
  const [volume, values, volumeRange] = await Promise.all([
    getResource<LokiVolumeResponse>(instance, 'index/volume', { query, start: statsStart, end, limit: 1000 }).catch(
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
    }).catch(() => null),
  ]);
  const volumes = volume?.data?.result;
  // Sum the per-label matrix into one total-ingest series (timestamps are unix seconds).
  const buckets = new Map<number, number>();
  for (const series of volumeRange?.data?.result ?? []) {
    for (const [ts, value] of series.values ?? []) {
      buckets.set(ts * 1000, (buckets.get(ts * 1000) ?? 0) + (Number(value) || 0));
    }
  }
  return {
    bytes: Array.isArray(volumes) ? volumes.reduce((total, entry) => total + (Number(entry.value?.[1]) || 0), 0) : null,
    sources: Array.isArray(values?.data) ? values.data.length : null,
    series: toSparkline([...buckets.entries()], 'Ingest volume'),
  };
}

/**
 * Distinct services seen by Tempo in the lookback, or null when the lookup fails. Uses the
 * datasource proxy: Tempo's resource router 404s these paths on cloud stacks.
 */
export async function fetchTracesServices(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<number | null> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeProxyGet<TempoTagValuesResponse>(ds.uid, 'api/v2/search/tag/resource.service.name/values', {
    start,
    end,
  });
  return Array.isArray(res?.tagValues) ? res.tagValues.length : null;
}

interface TempoQueryRangeResponse {
  series?: Array<{ samples?: Array<{ timestampMs?: string | number; value?: number }> }>;
}

/**
 * Span throughput over the last 24h via Tempo's TraceQL-metrics HTTP API: the summed series
 * feeds the sparkline, its integral is the span count. Datasource proxy on purpose — the
 * frontend query path rebuilds raw targets on some plugin versions. Needs the
 * metrics-generator; callers fail soft on rejection.
 */
export async function fetchTracesActivity(ds: Pick<DataSourceInstanceListItem, 'uid'>): Promise<TracesActivity> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - DATA_LOOKBACK_HOURS * 3600;
  const res = await probeProxyGet<TempoQueryRangeResponse>(ds.uid, 'api/metrics/query_range', {
    q: '{} | count_over_time()',
    start,
    end,
    step: '30m',
  });
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
  };
}

import { type DataSourceInstanceListItem, type FieldSparkline } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  createTtlCachedPromise,
  MAX_PROBED_DATASOURCES,
  PROBE_TIMEOUT_MS,
  RESOLUTION_TTL_MS,
  withRetry,
  withTimeout,
} from './dataUtils';
import { sparklineFromTotals } from './promQuery';

// Loki resource endpoints take nanosecond timestamps (same math as the Loki plugin's NS_IN_MS).
const NS_IN_MS = 1e6;

const MS_IN_HOUR = 60 * 60 * 1000;

// Primary stat window per design ("ingested · 7d").
const STATS_LOOKBACK_HOURS = 7 * 24;

// Sparkline and probe window per design ("Ingest volume · last 24h").
const VOLUME_LOOKBACK_HOURS = 24;

// Hourly buckets: 24 points for the sparkline, and "the last hour" is exactly the last bucket.
const VOLUME_STEP = '1h';

/** Spike = last hourly bucket at least this multiple of the mean of the earlier buckets. @lintignore */
export const LOGS_SPIKE_RATIO = 3;

/** Absolute spike floor (bytes in the last hour) so idle tenants never alert on noise. @lintignore */
export const LOGS_SPIKE_MIN_BYTES = 10_000_000;

// Never user-visible (useAsync swallows it) — no i18n. Tests assert this exact message.
const NO_LOGS_DATA_ERROR = 'No Loki datasource with log data';

// Exact UIDs of Grafana Cloud's utility Loki datasources (alert history, usage insights) — never
// where application logs live.
const CLOUD_UTILITY_LOKI_UIDS: Record<string, true> = {
  'grafanacloud-alert-state-history': true,
  'grafanacloud-usage-insights': true,
};

/** Label identifying log sources: service_name (OTel) with job (promtail-style) as fallback. */
export type LogsSourceLabel = 'service_name' | 'job';

// Probe order: prefer the OTel semantic-conventions label, fall back to classic scrape jobs.
const SOURCE_LABELS: LogsSourceLabel[] = ['service_name', 'job'];

export interface LogsResolution {
  ds: DataSourceInstanceListItem;
  sourceLabel: LogsSourceLabel;
}

export interface LogsStats {
  bytes7d: number;
  sources7d: number;
}

export interface LogsSpike {
  source: string;
  ratio: number;
}

export interface LogsVolume {
  series: FieldSparkline | null;
  spike: LogsSpike | null;
}

async function fetchLabelValues(uid: string, label: LogsSourceLabel, lookbackHours: number): Promise<string[]> {
  const end = Date.now();
  const start = end - lookbackHours * MS_IN_HOUR;
  const response = await getBackendSrv().get<{ data?: string[] }>(
    `/api/datasources/uid/${uid}/resources/label/${label}/values`,
    { start: start * NS_IN_MS, end: end * NS_IN_MS }
  );
  return response?.data ?? [];
}

// "Has log data" = a source label has values in the last 24h; an errored probe retries with
// backoff, then counts as no data — an unusable datasource must not win the probe.
async function probeLogsSourceLabel(ds: DataSourceInstanceListItem): Promise<LogsSourceLabel | null> {
  for (const label of SOURCE_LABELS) {
    try {
      const values = await withRetry(() =>
        withTimeout(fetchLabelValues(ds.uid, label, VOLUME_LOOKBACK_HOURS), PROBE_TIMEOUT_MS)
      );
      if (values.length > 0) {
        return label;
      }
    } catch {
      // Try the next label; a datasource erroring on every label counts as no data.
    }
  }
  return null;
}

// Priority: skipping cloud utility datasources — the default, then list order.
async function orderedCandidates(): Promise<DataSourceInstanceListItem[]> {
  const list = await withRetry(() =>
    getDataSourceInstanceList({
      type: 'loki',
      // Reject the -- Grafana -- builtin by meta.id; a ds.type check would drop loki-alias datasources.
      filter: (ds) => ds.meta.id !== 'grafana',
    })
  );
  const preferred = list.filter((ds) => !CLOUD_UTILITY_LOKI_UIDS[ds.uid]);
  const pool = preferred.length > 0 ? preferred : list;
  const def = pool.find((ds) => ds.isDefault);
  return def ? [def, ...pool.filter((ds) => ds !== def)] : [...pool];
}

// Probe the top-priority candidate alone first: in the common case (the default has log data)
// this issues 1 request instead of 10, and a transient sibling race can never outrank it. Only
// when the leader has no data (or errors through its retry) fan out to the rest in parallel.
async function resolveLogsLoki(): Promise<LogsResolution | null> {
  const candidates = (await orderedCandidates()).slice(0, MAX_PROBED_DATASOURCES);
  if (candidates.length === 0) {
    return null;
  }
  const leaderLabel = await probeLogsSourceLabel(candidates[0]);
  if (leaderLabel) {
    return { ds: candidates[0], sourceLabel: leaderLabel };
  }
  const rest = candidates.slice(1);
  const probes = rest.map((ds) => probeLogsSourceLabel(ds));
  for (let i = 0; i < rest.length; i++) {
    // Await in priority order: a slow probe delays — never changes — the outcome.
    const label = await probes[i];
    if (label) {
      return { ds: rest[i], sourceLabel: label };
    }
  }
  return null;
}

const logsResolution = createTtlCachedPromise(resolveLogsLoki, RESOLUTION_TTL_MS);

// Reset the cached datasource resolution (test seam).
export function resetLogsResolution(): void {
  logsResolution.reset();
}

/** Resolved Loki datasource with recent log data plus the label identifying sources, or null when none. */
export async function resolveLogsDatasource(): Promise<LogsResolution | null> {
  return logsResolution.get();
}

// All fetches await the same TTL-cached resolution promise, so concurrent mount = one probe, then
// the stats/volume requests run in parallel (a shared prerequisite, then parallel).

/** Ingested bytes and distinct sources over 7d; throws when no datasource has log data. */
export async function fetchLogsStats(): Promise<LogsStats> {
  const resolution = await logsResolution.get();
  if (!resolution) {
    throw new Error(NO_LOGS_DATA_ERROR);
  }
  const { ds, sourceLabel } = resolution;
  const end = Date.now();
  const start = end - STATS_LOOKBACK_HOURS * MS_IN_HOUR;
  const [stats, sources] = await Promise.all([
    withRetry(() =>
      getBackendSrv().get<{ bytes?: number }>(`/api/datasources/uid/${ds.uid}/resources/index/stats`, {
        query: `{${sourceLabel}=~".+"}`,
        start: start * NS_IN_MS,
        end: end * NS_IN_MS,
      })
    ),
    withRetry(() => fetchLabelValues(ds.uid, sourceLabel, STATS_LOOKBACK_HOURS)),
  ]);
  return { bytes7d: stats?.bytes ?? 0, sources7d: sources.length };
}

// Prometheus-matrix series from Loki's index/volume_range resource (bypasses the query runner).
interface VolumeSeries {
  metric?: Record<string, string>;
  values?: Array<[number, string]>;
}

/** Hourly ingest volume over 24h as a sparkline plus spike detection; throws when no datasource has log data. */
export async function fetchLogsVolume(): Promise<LogsVolume> {
  const resolution = await logsResolution.get();
  if (!resolution) {
    throw new Error(NO_LOGS_DATA_ERROR);
  }
  const { ds, sourceLabel } = resolution;
  const end = Date.now();
  const start = end - VOLUME_LOOKBACK_HOURS * MS_IN_HOUR;
  let response: { data?: { result?: VolumeSeries[] } };
  try {
    response = await withRetry(() =>
      getBackendSrv().get(`/api/datasources/uid/${ds.uid}/resources/index/volume_range`, {
        query: `{${sourceLabel}=~".+"}`,
        start: start * NS_IN_MS,
        end: end * NS_IN_MS,
        step: VOLUME_STEP,
        aggregateBy: 'labels',
        targetLabels: sourceLabel,
      })
    );
  } catch {
    // volume_range needs Loki >= 3.0; degrade to stats + CTA only.
    return { series: null, spike: null };
  }
  // The total-volume sparkline sums every series: some Lokis aggregate the whole volume under an
  // empty label value, and dropping those would blank the graph. Spike detection (inside
  // detectSpike) still requires a nameable source, so leftovers can never fire the alert.
  const series = response?.data?.result ?? [];
  return { series: buildVolumeSparkline(series), spike: detectSpike(series, sourceLabel) };
}

// Per-timestamp (prom-matrix seconds -> ms) sum across sources, rendered via sparklineFromTotals.
function buildVolumeSparkline(series: VolumeSeries[]): FieldSparkline | null {
  const totals = new Map<number, number>();
  for (const s of series) {
    for (const [sec, bytes] of s.values ?? []) {
      const value = parseFloat(bytes);
      if (Number.isFinite(value)) {
        totals.set(sec * 1000, (totals.get(sec * 1000) ?? 0) + value);
      }
    }
  }
  return sparklineFromTotals(totals, 'bytes');
}

// Per source: ratio = last bucket / mean of the earlier buckets. The max-ratio source fires when
// it clears both the ratio threshold and the absolute floor.
function detectSpike(series: VolumeSeries[], sourceLabel: LogsSourceLabel): LogsSpike | null {
  let top: LogsSpike | null = null;
  for (const s of series) {
    const source = s.metric?.[sourceLabel];
    const buckets = (s.values ?? []).map(([, v]) => parseFloat(v)).filter(Number.isFinite);
    if (!source || buckets.length < 2) {
      continue;
    }
    const last = buckets[buckets.length - 1];
    const previous = buckets.slice(0, -1);
    const mean = previous.reduce((sum, v) => sum + v, 0) / previous.length;
    if (mean <= 0 || last < LOGS_SPIKE_MIN_BYTES) {
      continue;
    }
    const ratio = last / mean;
    if (ratio >= LOGS_SPIKE_RATIO && (!top || ratio > top.ratio)) {
      top = { source, ratio };
    }
  }
  // Ratio rounds to an integer for the alert copy ("up 3× in the last hour").
  return top ? { source: top.source, ratio: Math.round(top.ratio) } : null;
}

import {
  type DataFrame,
  type DataSourceInstanceListItem,
  dateTime,
  type FieldSparkline,
  FieldType,
  type TimeRange,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';

import {
  createTtlCachedPromise,
  MAX_PROBED_DATASOURCES,
  PROBE_TIMEOUT_MS,
  RESOLUTION_TTL_MS,
  withRetry,
  withTimeout,
} from './dataUtils';
import { readLabeledAverages, runQueries, sparklineFromTotals } from './promQuery';

// TraceQL metrics get expensive with the window: 24h measured at 19s on a busy tenant, 3h under 4s.
const SPAN_RATE_LOOKBACK_HOURS = 3;

// The alert row talks about "the last hour"; keep the error-by-service query that cheap too.
const ERRORS_LOOKBACK_HOURS = 1;

/** Alert threshold: average error-span rate (spans/s). Absolute, not a ratio — `unset` status dominates totals. @lintignore */
export const TRACES_ERROR_MIN_RATE = 1;

// Never user-visible (useAsync swallows it) — no i18n. Tests assert this exact message.
const NO_TRACES_DATA_ERROR = 'No Tempo datasource with trace data';

export interface TracesResolution {
  ds: DataSourceInstanceListItem;
  serviceCount: number;
}

export interface SpanRateResult {
  series: FieldSparkline | null;
  errorRate: number | null;
}

// The minimal Tempo query model the runner needs; the tempo plugin's own types live out of repo.
interface TempoQuery extends DataQuery {
  query: string;
}

// Tempo's TraceQL-metrics label values can arrive quoted ("checkout"); strip for matching/display.
const unquote = (value: string) => value.replace(/^"(.*)"$/, '$1');

// Probe + primary stat share one endpoint: v2 tag values WITHOUT range params. Adding start/end
// forces a full-block scan that gateway-times-out (502) on large tenants; without them Tempo
// answers from the recent index.
async function probeTracesServiceCount(ds: DataSourceInstanceListItem): Promise<number> {
  try {
    const response = await withRetry(() =>
      withTimeout(
        getBackendSrv().get<{ tagValues?: Array<{ type?: string; value?: string }> }>(
          `/api/datasources/proxy/uid/${ds.uid}/api/v2/search/tag/resource.service.name/values`
        ),
        PROBE_TIMEOUT_MS
      )
    );
    return response?.tagValues?.length ?? 0;
  } catch {
    // An unusable datasource must not win the probe.
    return 0;
  }
}

// Priority: the default, then list order.
async function orderedCandidates(): Promise<DataSourceInstanceListItem[]> {
  const list = await withRetry(() =>
    getDataSourceInstanceList({
      type: 'tempo',
      // Reject the -- Grafana -- builtin by meta.id; a ds.type check would drop tempo-alias datasources.
      filter: (ds) => ds.meta.id !== 'grafana',
    })
  );
  const def = list.find((ds) => ds.isDefault);
  return def ? [def, ...list.filter((ds) => ds !== def)] : [...list];
}

// Probe the top-priority candidate alone first: in the common case (the default has trace data)
// this issues 1 request instead of 10, and a transient sibling race can never outrank it. Only
// when the leader has no data (or errors through its retry) fan out to the rest in parallel.
async function resolveTracesTempo(): Promise<TracesResolution | null> {
  const candidates = (await orderedCandidates()).slice(0, MAX_PROBED_DATASOURCES);
  if (candidates.length === 0) {
    return null;
  }
  const leaderCount = await probeTracesServiceCount(candidates[0]);
  if (leaderCount > 0) {
    return { ds: candidates[0], serviceCount: leaderCount };
  }
  const rest = candidates.slice(1);
  const probes = rest.map((ds) => probeTracesServiceCount(ds));
  for (let i = 0; i < rest.length; i++) {
    // Await in priority order: a slow probe delays — never changes — the outcome.
    const count = await probes[i];
    if (count > 0) {
      return { ds: rest[i], serviceCount: count };
    }
  }
  return null;
}

const tracesResolution = createTtlCachedPromise(resolveTracesTempo, RESOLUTION_TTL_MS);

// Reset the cached datasource resolution (test seam).
export function resetTracesResolution(): void {
  tracesResolution.reset();
}

/** Resolved Tempo datasource with trace data (service count included), or null when none. */
export async function resolveTracesDatasource(): Promise<TracesResolution | null> {
  return tracesResolution.get();
}

/** Count of services sending traces (from the resolution probe); throws when no datasource has trace data. */
export async function fetchTracesServices(): Promise<number> {
  const resolution = await tracesResolution.get();
  if (!resolution) {
    throw new Error(NO_TRACES_DATA_ERROR);
  }
  return resolution.serviceCount;
}

/**
 * Total span rate over 3h as a sparkline plus the average error-span rate. Degrades to nulls when
 * TraceQL metrics are unavailable (the card then renders stats + CTA only); throws only when no
 * datasource has trace data.
 */
export async function fetchSpanRateSeries(): Promise<SpanRateResult> {
  const resolution = await tracesResolution.get();
  if (!resolution) {
    throw new Error(NO_TRACES_DATA_ERROR);
  }
  const query: TempoQuery = { refId: 'spanRate', queryType: 'traceql', query: '{} | rate() by (status)' };
  let frames: DataFrame[];
  try {
    frames = await withRetry(() => runQueries([query], lastHoursRange(SPAN_RATE_LOOKBACK_HOURS), resolution.ds));
  } catch {
    // TraceQL metrics disabled or the query model rejected — never blank the whole card for it.
    return { series: null, errorRate: null };
  }
  const errorEntry = readLabeledAverages(frames, 'status').find((e) => unquote(e.label) === 'error');
  return { series: sumSpanRateSeries(frames), errorRate: errorEntry?.avg ?? null };
}

/** Service with the highest average error-span rate over the last hour; null on empty or error (never throws). */
export async function fetchTopErrorService(): Promise<{ service: string; rate: number } | null> {
  try {
    const resolution = await tracesResolution.get();
    if (!resolution) {
      return null;
    }
    const query: TempoQuery = {
      refId: 'errors',
      queryType: 'traceql',
      query: '{status=error} | rate() by (resource.service.name)',
    };
    const frames = await withRetry(() => runQueries([query], lastHoursRange(ERRORS_LOOKBACK_HOURS), resolution.ds));
    const entries = readLabeledAverages(frames, 'resource.service.name');
    if (entries.length === 0) {
      return null;
    }
    const top = entries.reduce((best, e) => (e.avg > best.avg ? e : best));
    return { service: unquote(top.label), rate: top.avg };
  } catch {
    // A missing alert row must not degrade the card.
    return null;
  }
}

function lastHoursRange(hours: number): TimeRange {
  return {
    from: dateTime().subtract(hours, 'h'),
    to: dateTime(),
    raw: { from: `now-${hours}h`, to: 'now' },
  };
}

// Sum the per-status rate series into one total-span-rate series, keyed by timestamp (ms). Series
// are identified by their `status` label (one runner call = one query; Tempo overwrites frame
// refIds with series names) — this also excludes the unlabeled exemplar companion frame.
function sumSpanRateSeries(frames: DataFrame[]): FieldSparkline | null {
  const totals = new Map<number, number>();
  for (const frame of frames) {
    const hasStatusSeries = frame.fields.some((f) => f.type === FieldType.number && f.labels?.status);
    if (!hasStatusSeries) {
      continue;
    }
    const x = frame.fields.find((f) => f.type === FieldType.time);
    const y = frame.fields.find((f) => f.type === FieldType.number);
    if (!x || !y || x.values.length !== y.values.length) {
      continue;
    }
    for (let i = 0; i < x.values.length; i++) {
      const ts = x.values[i];
      const value = y.values[i];
      if (typeof ts === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        totals.set(ts, (totals.get(ts) ?? 0) + value);
      }
    }
  }
  return sparklineFromTotals(totals, 'spans');
}

import {
  type DataFrame,
  type DataSourceApi,
  formattedValueToString,
  getValueFormat,
  rangeUtil,
  type QueryHint,
  type QueryResultMetaStat,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getLogQueryFromMetricsQuery } from 'app/plugins/datasource/loki/queryUtils';
import { dataFrameHasLokiError, extractLabelKeysFromDataFrame } from 'app/plugins/datasource/loki/responseUtils';
import {
  type DetectedFieldsResult,
  LabelType,
  type LokiQuery,
  type QueryStats,
} from 'app/plugins/datasource/loki/types';

import { type QueryFlowNode, QueryFlowNodeKind } from '../model/types';

import { type EnrichmentContext, type EnrichmentRow, type NodeEnrichment, type QueryFlowEnricher } from './types';
import { activeFrames, fmtBytes, fmtCount, hasRangeVariable, hintRows, maxSeverity, responseMetaRows } from './util';

/** Cap on detected-field rows so a wide pipeline doesn't produce an unbounded tooltip. */
const MAX_FIELD_ROWS = 8;

/** Subset of the Loki datasource API the enricher uses — kept structural so it stays mockable and decoupled. */
interface LokiDatasourceLike {
  getStats?: (query: LokiQuery, timeRange: TimeRange) => Promise<QueryStats | null>;
  getQueryHints?: (query: LokiQuery, result: DataFrame[]) => QueryHint[];
  languageProvider?: {
    fetchDetectedFields?: (opts: {
      expr: string;
      timeRange?: TimeRange;
      limit?: number;
    }) => Promise<DetectedFieldsResult | Error>;
  };
}

function isLokiDatasource(ds: DataSourceApi): ds is DataSourceApi & LokiDatasourceLike {
  return ds.type === 'loki';
}

// Grafana-only duration placeholders that the query editor lets users type directly into a range
// (`[$__auto]`, `[$__interval]`, ...). The normal query-run path resolves these via a `step`
// parameter the backend understands, but auxiliary endpoints like `/detected_fields` parse the
// LogQL literally and reject the placeholder text outright ("not a valid duration string").
const RANGE_VARIABLE_PATTERN = /\$\{?__(auto|interval|interval_ms|range|range_s|range_ms|rate_interval)\}?/g;

/**
 * Substitutes Grafana's range/interval placeholders with a concrete duration before sending `expr`
 * to a Loki endpoint that doesn't do this resolution itself. Prefers the interval the datasource
 * actually used for the last successful run of this query (`ctx.queryResponse.request.interval`),
 * falling back to a value computed from the visible time range when no run has happened yet.
 */
function resolveRangeVariables(expr: string, ctx: EnrichmentContext): string {
  if (!expr.includes('__')) {
    return expr;
  }
  const interval = ctx.queryResponse?.request?.interval || rangeUtil.calculateInterval(ctx.timeRange, 1000).interval;
  // A fresh RegExp each call avoids relying on a shared global-flag regex's mutable `lastIndex`.
  return expr.replace(new RegExp(RANGE_VARIABLE_PATTERN, RANGE_VARIABLE_PATTERN.flags), interval);
}

// Detected fields are a property of the whole pipeline (see `fetchDetectedFields`), so every Parser
// node in the same query would otherwise trigger an identical call. Cached per (datasource, expr,
// time range) — a query only needs one detected-fields fetch no matter how many parser nodes hover.
const detectedFieldsCache = new WeakMap<DataSourceApi, Map<string, Promise<DetectedFieldsResult | undefined>>>();

/**
 * Loki enricher. Network-backed overlays (selector index/stats, parser detected-fields) are fetched
 * lazily per node; root and label-type overlays are derived for free from the already-run result.
 */
export const lokiEnricher: QueryFlowEnricher = {
  datasourceType: 'loki',

  async enrichNode(node, ctx) {
    if (!isLokiDatasource(ctx.datasource)) {
      return undefined;
    }
    const ds = ctx.datasource;
    const rows: EnrichmentRow[] = [];
    let badge: string | undefined;
    let severity: NodeEnrichment['severity'];
    let note: string | undefined;
    // True only when a call that's expected to work actually threw — not when e.g. Loki has no
    // stats API — so a real backend failure doesn't get silently absorbed into "nothing to show
    // here" (indistinguishable from a node that legitimately has no overlay).
    let hadError = false;

    if (node.kind === QueryFlowNodeKind.Selector) {
      const stats = await fetchSelectorStats(ds, node, ctx).catch(() => {
        hadError = true;
        return null;
      });
      if (stats) {
        badge = t('explore.query-flow.enrichment.loki-scope-badge', '{{streams}} streams · {{size}}', {
          streams: fmtCount(stats.streams),
          size: fmtBytes(stats.bytes),
        });
        rows.push(
          { label: t('explore.query-flow.enrichment.streams', 'Streams'), value: fmtCount(stats.streams) },
          { label: t('explore.query-flow.enrichment.chunks', 'Chunks'), value: fmtCount(stats.chunks) },
          { label: t('explore.query-flow.enrichment.entries', 'Entries'), value: fmtCount(stats.entries) },
          { label: t('explore.query-flow.enrichment.size', 'Size'), value: fmtBytes(stats.bytes) }
        );
      }
    } else if (node.kind === QueryFlowNodeKind.Parser) {
      const detected = await fetchDetectedFields(ds, ctx).catch(() => {
        hadError = true;
        return undefined;
      });
      // The real API can omit/null `fields` (e.g. no fields detected) even though the response
      // object itself is present — don't assume it's always a populated array.
      if (detected?.fields && detected.fields.length > 0) {
        badge = t('explore.query-flow.enrichment.fields-badge', '', {
          count: detected.fields.length,
          defaultValue_one: '{{count}} field',
          defaultValue_other: '{{count}} fields',
        });
        for (const field of detected.fields.slice(0, MAX_FIELD_ROWS)) {
          const value = field.cardinality ? `${field.type} · ${fmtCount(field.cardinality)}` : field.type;
          rows.push({ label: field.label, value });
        }
      }
      if (activeFrames(ctx).some(dataFrameHasLokiError)) {
        severity = 'warning';
        note = t('explore.query-flow.enrichment.parse-errors', 'Some lines produced parse errors (__error__).');
      }
    } else if (node.kind === QueryFlowNodeKind.LabelFilter) {
      const type = classifyLabel(activeFrames(ctx), labelNameOf(node));
      if (type) {
        badge = labelTypeName(type);
        rows.push({ label: t('explore.query-flow.enrichment.label-type', 'Label type'), value: labelTypeName(type) });
      }
    } else if (node.kind === QueryFlowNodeKind.Range) {
      // Grafana range/interval placeholders (`[$__auto]`, `[$__interval]`, ...) are opaque in the
      // editor — show what they actually resolved to for the last run, same value `resolveRangeVariables`
      // substitutes in for the `/detected_fields` call above.
      const rangeText = ctx.expr.slice(node.span.from, node.span.to);
      if (hasRangeVariable(rangeText)) {
        const effective = resolveRangeVariables(rangeText, ctx);
        rows.push({ label: t('explore.query-flow.enrichment.effective-range', 'Effective range'), value: effective });
        badge = badge ?? effective;
      }
    }

    // Root overlays come from the already-run result — no extra calls.
    if (ctx.isRoot) {
      const frames = activeFrames(ctx);
      rows.push(...lokiSummaryRows(frames));
      if (frames.length > 0) {
        const result = t('explore.query-flow.enrichment.result-series', '', {
          count: frames.length,
          defaultValue_one: '{{count}} series',
          defaultValue_other: '{{count}} series',
        });
        rows.push({ label: t('explore.query-flow.enrichment.result', 'Result'), value: result });
        badge = badge ?? result;
      }
      rows.push(...hintRows(queryHints(ds, ctx, frames)));
      const overlay = responseMetaRows(ctx);
      rows.push(...overlay.rows);
      severity = maxSeverity(severity, overlay.severity);
    }

    if (badge === undefined && rows.length === 0) {
      return hadError ? { state: 'error' } : undefined;
    }
    return { state: 'done', badge, severity, rows, note };
  },
};

/**
 * Loki's parser/label-filter/line-filter suggestions, derived purely from the already-run result
 * frames — never rejects, mirrors the Prometheus enricher's hint handling.
 */
function queryHints(ds: LokiDatasourceLike, ctx: EnrichmentContext, frames: DataFrame[]): QueryHint[] {
  if (typeof ds.getQueryHints !== 'function') {
    return [];
  }
  const query: LokiQuery = { refId: ctx.refId, expr: ctx.expr };
  try {
    return ds.getQueryHints(query, frames) ?? [];
  } catch {
    return [];
  }
}

/** May reject — callers that want best-effort behavior should catch. */
async function fetchSelectorStats(
  ds: LokiDatasourceLike,
  node: QueryFlowNode,
  ctx: EnrichmentContext
): Promise<QueryStats | null> {
  if (typeof ds.getStats !== 'function') {
    return null;
  }
  const expr = ctx.expr.slice(node.span.from, node.span.to) || node.label;
  const query: LokiQuery = { refId: ctx.refId, expr };
  return ds.getStats(query, ctx.timeRange);
}

async function runFetchDetectedFields(
  fetchDetectedFieldsFn: (opts: {
    expr: string;
    timeRange?: TimeRange;
    limit?: number;
  }) => Promise<DetectedFieldsResult | Error>,
  ctx: EnrichmentContext
): Promise<DetectedFieldsResult | undefined> {
  // Pass the full pipeline: detected fields are a property of the whole selector+pipeline, not a
  // single stage. Two conversions first, since `/detected_fields` parses the text literally:
  // - `getLogQueryFromMetricsQuery` strips a metric wrapper (`quantile_over_time(...) by (...)`)
  //   down to `{selector} | pipeline` — the endpoint rejects a full metric query outright
  //   ("only log selector is supported").
  // - `resolveRangeVariables` swaps in a concrete duration for `$__auto`/`$__interval`/etc., which
  //   the main query-run path resolves but this endpoint doesn't understand as placeholder syntax.
  const expr = resolveRangeVariables(getLogQueryFromMetricsQuery(ctx.expr), ctx);
  const res = await fetchDetectedFieldsFn({ expr, timeRange: ctx.timeRange, limit: 1000 });
  // Some backends resolve this call to a bare array of fields rather than the documented
  // `{ fields, limit }` shape — normalize so callers can always read `.fields`.
  const normalized: DetectedFieldsResult | Error | undefined =
    res && !(res instanceof Error) && Array.isArray(res) ? { fields: res, limit: res.length } : res;
  return normalized instanceof Error ? undefined : normalized;
}

/** May reject — callers that want best-effort behavior should catch. */
function fetchDetectedFields(
  ds: DataSourceApi & LokiDatasourceLike,
  ctx: EnrichmentContext
): Promise<DetectedFieldsResult | undefined> {
  const languageProvider = ds.languageProvider;
  // Bind to `languageProvider` before detaching from the property access — the real Loki
  // LanguageProvider's `fetchDetectedFields` reads `this.datasource` internally, so calling the
  // extracted reference standalone (as this used to) throws "Cannot read properties of undefined
  // (reading 'datasource')" instead of ever reaching the network.
  const fetchDetectedFieldsFn = languageProvider?.fetchDetectedFields?.bind(languageProvider);
  if (typeof fetchDetectedFieldsFn !== 'function') {
    return Promise.resolve(undefined);
  }
  const key = `${ctx.expr}|${ctx.timeRange.from.valueOf()}-${ctx.timeRange.to.valueOf()}`;
  let cache = detectedFieldsCache.get(ds);
  if (!cache) {
    cache = new Map();
    detectedFieldsCache.set(ds, cache);
  }
  let cached = cache.get(key);
  if (!cached) {
    cached = runFetchDetectedFields(fetchDetectedFieldsFn, ctx);
    cache.set(key, cached);
    // Don't keep a failed fetch cached — let the next hover retry instead of failing for the session.
    const activeCache = cache;
    cached.catch(() => activeCache.delete(key));
  }
  return cached;
}

// A curated subset of the Store/Ingester sections — the ones that best signal query cost (chunks
// downloaded from object storage, dedup counts, ingesters reached) — rather than every low-level
// chunk-size internal Loki reports. Matched case-insensitively against `stat.displayName`.
const COST_STAT_NAMES = [
  'store: total chunks downloaded',
  'store: chunks download time',
  'store: total duplicates',
  'ingester: total reached',
  'ingester: total chunks matched',
  'ingester: total duplicates',
];

/**
 * Surface Loki's per-query stats: the "Summary" section (bytes/lines processed, exec time) — label
 * stripped of its section prefix, as before — plus a curated set of Store/Ingester cost signals,
 * which keep their section prefix since the same field name (e.g. "total duplicates") can appear in
 * both sections. Each stat is formatted using its own unit.
 */
export function lokiSummaryRows(frames: DataFrame[]): EnrichmentRow[] {
  for (const frame of frames) {
    const stats: QueryResultMetaStat[] = frame.meta?.stats ?? [];
    const summary = stats.filter((stat) => /bytes processed|lines processed|exec time/i.test(stat.displayName ?? ''));
    const cost = stats.filter((stat) => COST_STAT_NAMES.includes((stat.displayName ?? '').toLowerCase()));
    if (summary.length === 0 && cost.length === 0) {
      continue;
    }
    const fmt = (stat: QueryResultMetaStat) => formattedValueToString(getValueFormat(stat.unit ?? 'short')(stat.value));
    return [
      ...summary.map((stat) => ({ label: (stat.displayName ?? '').replace(/^summary:\s*/i, ''), value: fmt(stat) })),
      ...cost.map((stat) => ({ label: stat.displayName ?? '', value: fmt(stat) })),
    ];
  }
  return [];
}

/** LabelFilter labels look like `level="error"` / `status>=500`; take the leading identifier. */
export function labelNameOf(node: QueryFlowNode): string {
  const match = node.label.match(/^\s*([a-zA-Z_]\w*)/);
  return match ? match[1] : '';
}

/** Classify a label as Indexed / Structured / Parsed using the run result's `labelTypes` field. */
export function classifyLabel(frames: DataFrame[], labelName: string): LabelType | undefined {
  if (!labelName) {
    return undefined;
  }
  for (const type of [LabelType.Indexed, LabelType.StructuredMetadata, LabelType.Parsed]) {
    if (frames.some((frame) => extractLabelKeysFromDataFrame(frame, type).includes(labelName))) {
      return type;
    }
  }
  return undefined;
}

function labelTypeName(type: LabelType): string {
  switch (type) {
    case LabelType.Indexed:
      return t('explore.query-flow.enrichment.label-indexed', 'Indexed');
    case LabelType.StructuredMetadata:
      return t('explore.query-flow.enrichment.label-structured', 'Structured metadata');
    case LabelType.Parsed:
      return t('explore.query-flow.enrichment.label-parsed', 'Parsed');
    default:
      return '';
  }
}

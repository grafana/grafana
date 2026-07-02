import {
  type DataFrame,
  type DataSourceApi,
  formattedValueToString,
  getValueFormat,
  type QueryHint,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  PromApplication,
  type PromMetricsMetadata,
  type PromMetricsMetadataItem,
  type PromQuery,
} from '@grafana/prometheus';

import { type QueryFlowNode, QueryFlowNodeKind } from '../model/types';

import { type EnrichmentContext, type EnrichmentRow, type NodeEnrichment, type QueryFlowEnricher } from './types';
import { activeFrames, fmtCount, hasRangeVariable, hintRows, maxSeverity, responseMetaRows } from './util';

interface PromEnvelope<T> {
  status?: string;
  data?: T;
}
interface TsdbResponse {
  seriesCountByMetricName?: Array<{ name: string }>;
}
interface CardinalityResponse {
  series_count_total?: number;
}

/** Mirrors `@grafana/prometheus`'s `RuleQueryMapping` — not part of the package's public API surface. */
interface RecordingRuleMapping {
  [ruleName: string]: Array<{ query: string; labels?: Record<string, string> }>;
}

/** Subset of the Prometheus datasource API the enricher uses — structural so it stays mockable and decoupled. */
interface PromDatasourceLike {
  datasourceConfigurationPrometheusFlavor?: PromApplication;
  /** Scrape/min-step interval, e.g. `"15s"` — the datasource-wide floor a query's step can't beat. */
  interval?: string;
  /** Whether this Prometheus instance supports exemplars, probed once at datasource init. */
  exemplarsAvailable?: boolean;
  /** Recording-rule name -> underlying expression(s), loaded once from `/api/v1/rules` at init. */
  ruleMappings?: RecordingRuleMapping;
  languageProvider?: {
    queryMetricsMetadata?: (limit?: number) => Promise<PromMetricsMetadata>;
    /** Cached list of metrics ending in `_bucket` — the only free classic-histogram signal. */
    retrieveHistogramMetrics?: () => string[];
  };
  metadataRequest?: <R>(
    url: string,
    params?: Record<string, string | number>,
    options?: { showErrorAlert?: boolean }
  ) => Promise<{ data?: R }>;
  getQueryHints?: (query: PromQuery, result: unknown[]) => QueryHint[];
}

type PromDatasource = DataSourceApi & PromDatasourceLike;

// Datasource-global lookups, cached per datasource instance for the session (range-independent).
const metadataCache = new WeakMap<DataSourceApi, Promise<PromMetricsMetadata>>();
const tsdbTopMetricsCache = new WeakMap<DataSourceApi, Promise<Set<string>>>();
// Cardinality reflects current active series (not a time-range query), so it's safe to reuse across
// hovers/query edits for the session as long as the selector text is unchanged — this avoids one
// `/api/v1/cardinality/label_values` call per hover when a graph has many selectors.
const cardinalityCache = new WeakMap<DataSourceApi, Map<string, Promise<number | undefined>>>();

function isPrometheusDatasource(ds: DataSourceApi): ds is PromDatasource {
  return ds.type === 'prometheus';
}

/**
 * Prometheus enricher. Metric metadata is read from the language provider's cache (no real call);
 * a single `status/tsdb` snapshot (shared across selectors) flags high-cardinality metrics; an exact
 * per-selector series count is fetched only when the datasource is Mimir (cardinality API). Vanilla
 * Prometheus never triggers a heavy series scan.
 */
export const promEnricher: QueryFlowEnricher = {
  datasourceType: 'prometheus',

  async enrichNode(node, ctx) {
    if (!isPrometheusDatasource(ctx.datasource)) {
      return undefined;
    }
    const ds = ctx.datasource;
    const rows: EnrichmentRow[] = [];
    let badge: string | undefined;
    let severity: NodeEnrichment['severity'];
    let note: string | undefined;
    // True only when a call that's expected to work actually threw — not when e.g. an optional
    // endpoint is unavailable, so a real backend failure doesn't get silently absorbed into
    // "nothing to show here" (indistinguishable from a node that legitimately has no overlay).
    let hadError = false;

    if (node.kind === QueryFlowNodeKind.Selector) {
      const metric = node.label.trim();
      if (metric) {
        const meta = await fetchMetricMetadata(ds, metric).catch(() => {
          hadError = true;
          return undefined;
        });
        if (meta?.type) {
          badge = meta.type;
          rows.push({ label: t('explore.query-flow.enrichment.type', 'Type'), value: meta.type });
        }
        if (meta?.unit) {
          rows.push({ label: t('explore.query-flow.enrichment.unit', 'Unit'), value: meta.unit });
        }
        if (meta?.help) {
          note = meta.help;
        }

        if (meta?.type !== 'histogram' && isClassicHistogramBucket(ds, metric)) {
          rows.push({
            label: t('explore.query-flow.enrichment.histogram', 'Histogram'),
            value: t('explore.query-flow.enrichment.histogram-classic', 'Classic (bucket metric)'),
          });
        }

        const recordingRule = ds.ruleMappings?.[metric];
        if (recordingRule && recordingRule.length > 0) {
          badge = badge ?? t('explore.query-flow.enrichment.recording-rule', 'Recording rule');
          rows.push({
            label: t('explore.query-flow.enrichment.recording-rule-query', 'Recording rule for'),
            value: recordingRule[0].query,
          });
          if (recordingRule.length > 1) {
            rows.push({
              label: t('explore.query-flow.enrichment.recording-rule-definitions', 'Definitions'),
              value: fmtCount(recordingRule.length),
            });
          }
        }

        if ((await topCardinalityMetrics(ds)).has(metric)) {
          severity = 'warning';
          badge = badge ?? t('explore.query-flow.enrichment.high-cardinality', 'High cardinality');
          rows.push({
            label: t('explore.query-flow.enrichment.cardinality', 'Cardinality'),
            value: t('explore.query-flow.enrichment.high-cardinality-top', 'High (top metric)'),
          });
        }

        const seriesCount = await fetchMimirSeriesCount(ds, node, ctx).catch(() => {
          hadError = true;
          return undefined;
        });
        if (seriesCount != null) {
          rows.push({ label: t('explore.query-flow.enrichment.series', 'Series'), value: fmtCount(seriesCount) });
        }
      }
    } else if (node.kind === QueryFlowNodeKind.Range) {
      // `[$__rate_interval]`/`[$__interval]` etc. are opaque in the editor — show what they actually
      // resolved to for the last run (the same interval Explore's own `getIntervals` computed to
      // build that request), alongside the datasource's scrape floor for comparison.
      const rangeText = ctx.expr.slice(node.span.from, node.span.to);
      const effectiveInterval = ctx.queryResponse?.request?.interval;
      if (hasRangeVariable(rangeText) && effectiveInterval) {
        rows.push({
          label: t('explore.query-flow.enrichment.effective-step', 'Effective step'),
          value: effectiveInterval,
        });
        badge = badge ?? effectiveInterval;
        if (ds.interval) {
          rows.push({
            label: t('explore.query-flow.enrichment.scrape-interval', 'Scrape interval'),
            value: ds.interval,
          });
        }
      }
    }

    if (ctx.isRoot) {
      const frames = activeFrames(ctx);
      rows.push(...hintRows(queryHints(ds, ctx, frames)));
      if (frames.length > 0) {
        const result = t('explore.query-flow.enrichment.result-series', '', {
          count: frames.length,
          defaultValue_one: '{{count}} series',
          defaultValue_other: '{{count}} series',
        });
        rows.push({ label: t('explore.query-flow.enrichment.result', 'Result'), value: result });
        badge = badge ?? result;
      }
      // Query cost from the response `stats` — present only when the query was sent with stats=all.
      rows.push(...promQueryCostRows(frames));
      rows.push(...promResultTypeRow(frames));
      if (ds.exemplarsAvailable) {
        rows.push({
          label: t('explore.query-flow.enrichment.exemplars', 'Exemplars'),
          value: t('explore.query-flow.enrichment.exemplars-available', 'Available'),
        });
      }
      const overlay = responseMetaRows(ctx);
      rows.push(...overlay.rows);
      severity = maxSeverity(severity, overlay.severity);
    }

    if (badge === undefined && rows.length === 0 && note === undefined) {
      return hadError ? { state: 'error' } : undefined;
    }
    return { state: 'done', badge, severity, rows, note };
  },
};

function fetchAllMetricMetadata(ds: PromDatasource): Promise<PromMetricsMetadata> {
  const existing = metadataCache.get(ds);
  if (existing) {
    return existing;
  }
  const lp = ds.languageProvider;
  const created: Promise<PromMetricsMetadata> = lp?.queryMetricsMetadata
    ? lp.queryMetricsMetadata()
    : Promise.resolve<PromMetricsMetadata>({});
  metadataCache.set(ds, created);
  // Don't keep a failed fetch cached for the rest of the session — let the next hover retry it.
  created.catch(() => metadataCache.delete(ds));
  return created;
}

/** May reject — callers that want best-effort behavior should catch. */
async function fetchMetricMetadata(ds: PromDatasource, metric: string): Promise<PromMetricsMetadataItem | undefined> {
  const all = await fetchAllMetricMetadata(ds);
  return all?.[metric];
}

/**
 * Top metrics by series count from `/api/v1/status/tsdb` — one cheap snapshot reused across
 * selectors. Purely an optional overlay (high-cardinality flagging), so failures degrade silently
 * to "nothing flagged" rather than surfacing as a node error.
 */
function topCardinalityMetrics(ds: PromDatasource): Promise<Set<string>> {
  let cached = tsdbTopMetricsCache.get(ds);
  if (!cached) {
    cached = fetchPromResource<TsdbResponse>(ds, '/api/v1/status/tsdb')
      .then((payload) => new Set((payload?.seriesCountByMetricName ?? []).map((entry) => entry.name)))
      .catch(() => new Set<string>());
    tsdbTopMetricsCache.set(ds, cached);
  }
  return cached;
}

/**
 * Mimir-only: exact active-series count for a selector via the cardinality API (cheap, in-memory).
 * May reject — callers that want best-effort behavior should catch.
 */
async function fetchMimirSeriesCount(
  ds: PromDatasource,
  node: QueryFlowNode,
  ctx: EnrichmentContext
): Promise<number | undefined> {
  if (ds.datasourceConfigurationPrometheusFlavor !== PromApplication.Mimir) {
    return undefined;
  }
  const selector = ctx.expr.slice(node.span.from, node.span.to);
  if (!selector) {
    return undefined;
  }
  let cache = cardinalityCache.get(ds);
  if (!cache) {
    cache = new Map();
    cardinalityCache.set(ds, cache);
  }
  let cached = cache.get(selector);
  if (!cached) {
    cached = fetchPromResource<CardinalityResponse>(ds, '/api/v1/cardinality/label_values', {
      selector,
      'label_names[]': '__name__',
      limit: 1,
    }).then((payload) => (typeof payload?.series_count_total === 'number' ? payload.series_count_total : undefined));
    cache.set(selector, cached);
    // Don't keep a failed fetch cached — let the next hover retry instead of failing for the session.
    const activeCache = cache;
    cached.catch(() => activeCache.delete(selector));
  }
  return cached;
}

/**
 * All of the datasource's query-improvement suggestions (rate, histogram_quantile, recording-rule
 * expand, sum-by for high series counts, ...), derived purely from the already-run result frames —
 * never rejects.
 */
function queryHints(ds: PromDatasource, ctx: EnrichmentContext, frames: DataFrame[]): QueryHint[] {
  if (typeof ds.getQueryHints !== 'function') {
    return [];
  }
  const query: PromQuery = { refId: ctx.refId, expr: ctx.expr };
  try {
    return ds.getQueryHints(query, frames) ?? [];
  } catch {
    return [];
  }
}

/**
 * Classic histograms scrape as `<metric>_bucket` counters — metadata reports `type: 'counter'`, not
 * `histogram`, so the `_bucket` suffix is the only free signal that a selector is part of one (the
 * same detection `getQueryHints`'s `HISTOGRAM_QUANTILE` hint relies on internally). Prefers the
 * datasource's cached histogram-metric list when available, since it reflects what's actually been
 * scraped rather than a naive suffix guess.
 */
function isClassicHistogramBucket(ds: PromDatasource, metric: string): boolean {
  const cached = ds.languageProvider?.retrieveHistogramMetrics?.();
  return cached ? cached.includes(metric) : metric.endsWith('_bucket');
}

/**
 * Call a Prometheus resource endpoint and unwrap the payload. `metadataRequest` resolves a response
 * whose `data` is the Prometheus envelope `{ status, data }`. May reject — callers decide whether a
 * failure here is a soft-fail (see `topCardinalityMetrics`) or should surface as a node error.
 */
async function fetchPromResource<T>(
  ds: PromDatasource,
  url: string,
  params?: Record<string, string | number>
): Promise<T | undefined> {
  if (typeof ds.metadataRequest !== 'function') {
    return undefined;
  }
  const res = await ds.metadataRequest<PromEnvelope<T>>(url, params, { showErrorAlert: false });
  return res?.data?.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Safely read a number at a dot-path from an unknown object (the response `stats` shape isn't typed). */
function readNumber(source: unknown, path: string[]): number | undefined {
  let current = source;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return typeof current === 'number' ? current : undefined;
}

/**
 * Query cost from the Prometheus response `stats` object, which the backend stores in `frame.meta.custom.stats`
 * when the query was sent with `stats=all`. Absent on plain queries — so this yields nothing until that is enabled.
 */
function promQueryCostRows(frames: DataFrame[]): EnrichmentRow[] {
  for (const frame of frames) {
    const custom: unknown = frame.meta?.custom;
    const stats = isRecord(custom) ? custom.stats : undefined;
    const samples = readNumber(stats, ['samples', 'totalQueryableSamples']);
    const peak = readNumber(stats, ['samples', 'peakSamples']);
    const evalSeconds = readNumber(stats, ['timings', 'evalTotalTime']);

    const rows: EnrichmentRow[] = [];
    if (samples != null) {
      rows.push({ label: t('explore.query-flow.enrichment.samples', 'Samples processed'), value: fmtCount(samples) });
    }
    if (peak != null) {
      rows.push({ label: t('explore.query-flow.enrichment.peak-samples', 'Peak samples'), value: fmtCount(peak) });
    }
    if (evalSeconds != null) {
      rows.push({
        label: t('explore.query-flow.enrichment.eval-time', 'Eval time'),
        value: formattedValueToString(getValueFormat('s')(evalSeconds)),
      });
    }
    if (rows.length > 0) {
      return rows;
    }
  }
  return [];
}

/** Free result-shape signal from `frame.meta.custom.resultType` (`matrix` / `vector` / `exemplar`). */
function promResultTypeRow(frames: DataFrame[]): EnrichmentRow[] {
  for (const frame of frames) {
    const custom: unknown = frame.meta?.custom;
    const resultType = isRecord(custom) && typeof custom.resultType === 'string' ? custom.resultType : undefined;
    if (resultType) {
      return [{ label: t('explore.query-flow.enrichment.result-type', 'Result type'), value: resultType }];
    }
  }
  return [];
}

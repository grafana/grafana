import {
  type DataFrame,
  formattedValueToString,
  getValueFormat,
  LoadingState,
  type QueryHint,
  type QueryResultMetaNotice,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { type EnrichmentContext, type EnrichmentRow, type EnrichmentSeverity } from './types';

/** Bytes formatted SI-decimal (kB/MB), matching how datasources report processed/scanned volume. */
export const fmtBytes = (bytes: number): string => formattedValueToString(getValueFormat('decbytes')(bytes));

/** Short, abbreviated count (1.2 K, 3 M). */
export const fmtCount = (n: number): string => formattedValueToString(getValueFormat('short')(n));

/** Duration in milliseconds, auto-scaled (450 ms, 1.2 s), matching request/processing timings. */
export const fmtMs = (ms: number): string => formattedValueToString(getValueFormat('ms')(ms));

/** Frames from the active (already-run) query — the source of free, in-memory overlays. */
export function activeFrames(ctx: EnrichmentContext): DataFrame[] {
  if (ctx.queryResponse?.state !== LoadingState.Done) {
    return [];
  }
  return (ctx.queryResponse.series ?? []).filter((frame) => frame.refId === ctx.refId);
}

const SEVERITY_RANK: Record<EnrichmentSeverity, number> = { info: 0, warning: 1, error: 2 };

/** Combine two optional severities, keeping whichever is more urgent. */
export function maxSeverity(
  a: EnrichmentSeverity | undefined,
  b: EnrichmentSeverity | undefined
): EnrichmentSeverity | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

function noticeLabel(severity: QueryResultMetaNotice['severity']): string {
  switch (severity) {
    case 'error':
      return t('explore.query-flow.enrichment.notice-error', 'Error');
    case 'warning':
      return t('explore.query-flow.enrichment.notice-warning', 'Warning');
    default:
      return t('explore.query-flow.enrichment.notice-info', 'Notice');
  }
}

export interface ResponseMetaOverlay {
  rows: EnrichmentRow[];
  severity?: EnrichmentSeverity;
}

/**
 * Datasource-agnostic root-node overlay built entirely from the already-run response — no extra
 * network calls. Surfaces the same request timing, executed query, and error/trace data the Query
 * Inspector's Stats/Query/Error tabs show, plus any backend `notices` and a "limit reached" warning,
 * so a user doesn't have to open the inspector to see them.
 */
export function responseMetaRows(ctx: EnrichmentContext): ResponseMetaOverlay {
  const rows: EnrichmentRow[] = [];
  let severity: EnrichmentSeverity | undefined;
  const frames = activeFrames(ctx);
  const request = ctx.queryResponse?.request;

  if (
    typeof request?.startTime === 'number' &&
    typeof request?.endTime === 'number' &&
    request.endTime >= request.startTime
  ) {
    rows.push({
      label: t('explore.query-flow.enrichment.request-time', 'Request time'),
      value: fmtMs(request.endTime - request.startTime),
    });
  }
  const processingMs = ctx.queryResponse?.timings?.dataProcessingTime;
  if (typeof processingMs === 'number') {
    rows.push({
      label: t('explore.query-flow.enrichment.processing-time', 'Processing time'),
      value: fmtMs(processingMs),
    });
  }

  const executedQuery = frames
    .map((frame) => frame.meta?.executedQueryString)
    .find((value): value is string => !!value);
  if (executedQuery && executedQuery !== ctx.expr) {
    rows.push({ label: t('explore.query-flow.enrichment.executed-query', 'Executed query'), value: executedQuery });
  }

  for (const frame of frames) {
    const limit = frame.meta?.limit;
    if (typeof limit === 'number' && limit > 0 && frame.length >= limit) {
      severity = maxSeverity(severity, 'warning');
      rows.push({
        label: t('explore.query-flow.enrichment.limit', 'Limit'),
        value: t('explore.query-flow.enrichment.limit-reached', 'Reached ({{limit}})', { limit: fmtCount(limit) }),
      });
      break;
    }
  }

  for (const frame of frames) {
    for (const notice of frame.meta?.notices ?? []) {
      severity = maxSeverity(severity, notice.severity);
      rows.push({ label: noticeLabel(notice.severity), value: notice.text });
    }
  }

  const error = ctx.queryResponse?.errors?.find((err) => !err.refId || err.refId === ctx.refId);
  if (error) {
    severity = 'error';
    rows.push({
      label: t('explore.query-flow.enrichment.error', 'Error'),
      value: error.message || error.statusText || t('explore.query-flow.enrichment.query-failed', 'Query failed'),
    });
    if (error.traceId) {
      rows.push({ label: t('explore.query-flow.enrichment.trace-id', 'Trace ID'), value: error.traceId });
    }
  } else if (ctx.queryResponse?.traceIds?.length) {
    rows.push({ label: t('explore.query-flow.enrichment.trace-id', 'Trace ID'), value: ctx.queryResponse.traceIds[0] });
  }

  return { rows, severity };
}

/** True when `text` contains a Grafana range/interval placeholder like `$__rate_interval` or `$__auto`. */
export function hasRangeVariable(text: string): boolean {
  return /\$\{?__(auto|interval|interval_ms|rate_interval|range|range_s|range_ms)\}?/.test(text);
}

/** Cap on hint rows so a query with many simultaneous suggestions doesn't produce an unbounded tooltip. */
const MAX_HINT_ROWS = 5;

/**
 * Turn a datasource's `getQueryHints()` result into display rows, one per hint (capped). Each hint's
 * `fix` describes an actionable query edit, but QueryFlow only surfaces the human-readable label here
 * — it doesn't wire up applying the fix.
 */
export function hintRows(hints: QueryHint[]): EnrichmentRow[] {
  return hints
    .slice(0, MAX_HINT_ROWS)
    .map((hint) => ({ label: t('explore.query-flow.enrichment.hint', 'Hint'), value: hint.label }));
}

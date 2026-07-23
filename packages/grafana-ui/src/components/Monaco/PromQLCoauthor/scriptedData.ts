/**
 * Scripted (canned) data for the PromQL co-authoring prototype.
 * No LLM — everything the assistant "produces" is pre-authored so the demo is
 * deterministic. Three distinct, realistic queries, one per journey:
 *   - Scratch  → a clean, idiomatic query (nothing to optimise).
 *   - Mid-query→ a partial query the assistant completes.
 *   - Pasted   → the user's own query, with real anti-patterns to recommend on.
 */
import { type ChipModel, type Stage, type StepModel } from './types';

/** Op colours, matching the design's palette. */
export const COLORS = {
  metric: '#5794F2',
  rate: '#73BF69',
  sum: '#B877D9',
  divide: '#F2495C',
  topk: '#FF9830',
  /** Assistant accent + ghost-suggestion blue. */
  assistant: '#6E9FFF',
  warn: '#F5B73D',
} as const;

const chip = (label: string, color: string, count?: string): ChipModel => ({ label, color, count });
const ghost = (label: string): ChipModel => ({ label, color: '', ghost: true });

// ---------------------------------------------------------------------------
// Journey 1 — from scratch. The assistant writes a clean, good query.
// ---------------------------------------------------------------------------

/** A plain-language question (no PromQL jargon) that maps onto the query below. */
export const SCRATCH_NL = 'How slow are my services for most users?';

/** A good, idiomatic p95-latency query — nothing to optimise. */
export const SCRATCH_QUERY =
  'histogram_quantile(0.95, sum by(le, service) (rate(http_request_duration_seconds_bucket[$__rate_interval])))';

/** Compact preview shown in the popover before accept. */
export const SCRATCH_PROMQL_PREVIEW =
  'histogram_quantile(0.95, sum by(le, service) (rate(http_request_duration_seconds_bucket[$__rate_interval])))';

/** Ghost chips shown while the flow is "building" (before the query is written). */
export const BUILD_GHOST: ChipModel[] = [ghost('metric'), ghost('rate'), ghost('sum by'), ghost('quantile')];

/** The complete, generated scratch flow. */
export const SCRATCH_FLOW: ChipModel[] = [
  chip('…duration_bucket', COLORS.metric, '96'),
  chip('rate', COLORS.rate, '96'),
  chip('sum by(le, service)', COLORS.sum, '24'),
  chip('histogram_quantile 0.95', COLORS.topk, '4'),
];

// ---------------------------------------------------------------------------
// Journey 2 — mid-query. Recognise a partial query, suggest the completion.
// ---------------------------------------------------------------------------

/** What the presenter types to seed the mid-query demo (a 5xx request rate). */
export const PARTIAL_QUERY = 'sum by(service) (rate(http_requests_total{status=~"5.."}[$__rate_interval]))';

/** The completed query the assistant suggests: a 5xx error ratio per service. */
export const MIDQUERY_QUERY =
  'sum by(service) (rate(http_requests_total{status=~"5.."}[$__rate_interval])) / sum by(service) (rate(http_requests_total[$__rate_interval]))';

/** Compact preview of the completed mid-query. */
export const MIDQUERY_PROMQL_PREVIEW =
  'sum by(service)(rate(http_requests_total{status=~"5.."}[…])) / sum by(service)(rate(http_requests_total[…]))';

/** Journey 2 stages: recognised so far → suggested completion. */
export const MIDQUERY_STAGES: Stage[] = [
  {
    chips: [
      chip('…requests_total{5xx}', COLORS.metric, '40'),
      chip('rate', COLORS.rate, '40'),
      chip('sum by(service)', COLORS.sum, '8'),
    ],
    flowLabel: 'Recognised so far',
    hint: "You're rating 5xx responses, summed to 8 series by service. What next?",
  },
  {
    chips: [
      chip('…requests_total{5xx}', COLORS.metric, '40'),
      chip('rate', COLORS.rate, '40'),
      chip('sum by(service)', COLORS.sum, '8'),
      ghost('÷ by total'),
      ghost('error ratio'),
    ],
    flowLabel: 'Suggested completion',
    suggest: true,
    hint: 'Divide by the total request rate per service to get an error ratio (0–1).',
  },
];

/** Optimisation / debug recommendations for the mid-query completion. */
export const MIDQUERY_TIPS: string[] = [
  'Optimize: extract sum by(service)(rate(http_requests_total[…])) into a recording rule — it appears on both sides.',
  'Debug: getting no data? Confirm the label is `status` (not `code`) and that 5xx traffic exists in the range.',
];

// ---------------------------------------------------------------------------
// Journey 3 — pasted. The user's own query, with real anti-patterns to fix.
// ---------------------------------------------------------------------------

/** The query the presenter pastes — realistic but in need of help. */
export const PASTED_QUERY =
  'topk(5, sum by(path, service_name) (rate(quickpizza_server_http_request_duration_seconds_sum[$__rate_interval])) / sum by(path, service_name) (rate(quickpizza_server_http_request_duration_seconds_count[$__rate_interval])))';

/**
 * Per-step explanations for the non-AI query-flow panel (journey 3).
 * Reads top-to-bottom in data-flow order, surfacing tips/recommendations.
 */
export const FLOW_STEPS: StepModel[] = [
  {
    color: COLORS.metric,
    title: '…duration_seconds_sum · _count',
    desc: 'Fetch both raw counters over the last $__rate_interval.',
    out: '48 + 48 series',
    note: 'path is high-cardinality (~1.2k values). A label matcher would cut fetched series.',
    noteColor: COLORS.warn,
  },
  {
    color: COLORS.rate,
    title: 'rate()',
    desc: 'Turn each counter into a per-second rate.',
    out: '48 + 48 series',
  },
  {
    color: COLORS.sum,
    title: 'sum by(path, service_name)',
    desc: 'Add series together, keeping one per path + service.',
    out: '12 + 12 series',
    note: 'Good candidate for a recording rule — this pipeline runs on every refresh.',
    noteColor: COLORS.assistant,
  },
  {
    color: COLORS.divide,
    title: '÷ divide',
    desc: 'Match series by identical labels; total duration ÷ request count = average latency.',
    out: '12 series',
  },
  {
    color: COLORS.topk,
    title: 'topk(5)',
    desc: 'Keep the 5 slowest path + service pairs.',
    out: '5 series',
    note: 'topk(5) picks globally. topk by(service_name)(5, …) keeps the slowest 5 per service instead.',
    noteColor: COLORS.warn,
  },
];

/** The collapsed one-line flow (used as the panel header strip). */
export const FLOW_STRIP: ChipModel[] = [
  chip('…duration_seconds', COLORS.metric),
  chip('rate', COLORS.rate),
  chip('sum by', COLORS.sum),
  chip('÷', COLORS.divide),
  chip('topk 5', COLORS.topk),
];

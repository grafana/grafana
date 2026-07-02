import { t } from '@grafana/i18n';

import { type QueryFlowGraph, QueryFlowNodeKind } from '../model/types';

import { type DiagnosticRule, type QueryFlowDiagnostic } from './types';
import { ancestors, isRangeVectorFn, sliceSpan } from './util';

function isCounterName(label: string): boolean {
  return label.endsWith('_total');
}

// --- PromQL best-practice / next-step suggestions -------------------------------------------------

/** A counter selector that isn't fed into a rate-family function — nudge towards rate(). */
const counterNeedsRate: DiagnosticRule = (graph, expr) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Selector || !isCounterName(node.label)) {
      continue;
    }
    const alreadyRated = ancestors(graph, id).some(
      (ancestor) => ancestor.kind === QueryFlowNodeKind.Function && isRangeVectorFn(ancestor.label)
    );
    if (alreadyRated) {
      continue;
    }
    out.push({
      id: `prom-suggest-counter:${id}`,
      nodeId: id,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.prom-suggest-counter',
        'This looks like a counter — wrap it in rate() to see its per-second change.'
      ),
      suggestion: `rate(${sliceSpan(expr, node.span)}[5m])`,
    });
  }
  return out;
};

/** A rate-family result with no aggregation above it — suggest combining series with sum by(). */
const rateNeedsAggregation: DiagnosticRule = (graph) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Function || !isRangeVectorFn(node.label)) {
      continue;
    }
    // An Aggregation ancestor already combines series. A Function ancestor (e.g.
    // `histogram_quantile(0.99, rate(x_bucket[5m]))`) already consumes the per-series result in a
    // deliberate way too — suggesting "aggregate this" there is usually noise, not a real issue.
    const consumed = ancestors(graph, id).some(
      (ancestor) => ancestor.kind === QueryFlowNodeKind.Aggregation || ancestor.kind === QueryFlowNodeKind.Function
    );
    if (consumed) {
      continue;
    }
    out.push({
      id: `prom-suggest-aggregate:${id}`,
      nodeId: id,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.prom-suggest-aggregate',
        'Aggregate with sum by(...) to combine series across instances.'
      ),
    });
  }
  return out;
};

/** A bare (non-counter) selector as the whole query — suggest a function or aggregation. */
const bareSelectorNeedsSummary: DiagnosticRule = (graph) => {
  const root = graph.nodes[graph.rootId];
  if (!root || root.kind !== QueryFlowNodeKind.Selector || isCounterName(root.label)) {
    return [];
  }
  return [
    {
      id: `prom-suggest-summarize:${root.id}`,
      nodeId: root.id,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.prom-suggest-summarize',
        'Add a function like rate() or an aggregation like sum() to summarize this metric.'
      ),
    },
  ];
};

export const promSuggestionRules: DiagnosticRule[] = [counterNeedsRate, rateNeedsAggregation, bareSelectorNeedsSummary];

// --- LogQL best-practice / next-step suggestions --------------------------------------------------

const LOG_QUERY_ROOT_KINDS: ReadonlySet<QueryFlowNodeKind> = new Set([
  QueryFlowNodeKind.Selector,
  QueryFlowNodeKind.LineFilter,
  QueryFlowNodeKind.Parser,
  QueryFlowNodeKind.LabelFilter,
  QueryFlowNodeKind.LabelFormat,
]);

// A "plain" log query — nothing has extracted or reshaped fields yet, so wrapping the whole thing in
// count_over_time() is a clean next step. Once a parser/label stage has run, the user has already
// moved past "just count the lines" and the tip mostly just adds noise.
const PLAIN_LOG_QUERY_ROOT_KINDS: ReadonlySet<QueryFlowNodeKind> = new Set([
  QueryFlowNodeKind.Selector,
  QueryFlowNodeKind.LineFilter,
]);

/** Whether the query returns log lines (vs a metric). Metric queries root at an aggregation/function. */
function isLogQuery(graph: QueryFlowGraph): boolean {
  const root = graph.nodes[graph.rootId];
  return !!root && LOG_QUERY_ROOT_KINDS.has(root.kind);
}

function firstNodeOfKind(graph: QueryFlowGraph, kind: QueryFlowNodeKind): string | undefined {
  return Object.keys(graph.nodes).find((id) => graph.nodes[id].kind === kind);
}

/** A log query with no line filter — suggest narrowing the stream. */
const logNeedsLineFilter: DiagnosticRule = (graph) => {
  if (!isLogQuery(graph)) {
    return [];
  }
  const selectorId = firstNodeOfKind(graph, QueryFlowNodeKind.Selector);
  if (!selectorId || firstNodeOfKind(graph, QueryFlowNodeKind.LineFilter)) {
    return [];
  }
  return [
    {
      id: `logql-suggest-linefilter:${selectorId}`,
      nodeId: selectorId,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.logql-suggest-linefilter',
        'Add a line filter such as |= "error" to narrow the stream.'
      ),
    },
  ];
};

/** A plain log query (no parsing/labeling yet) — suggest turning it into a metric to graph volume over time. */
const logCanBecomeMetric: DiagnosticRule = (graph) => {
  const root = graph.nodes[graph.rootId];
  if (!root || !PLAIN_LOG_QUERY_ROOT_KINDS.has(root.kind)) {
    return [];
  }
  return [
    {
      id: `logql-suggest-metric:${root.id}`,
      nodeId: root.id,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.logql-suggest-metric',
        'Wrap in count_over_time(...[5m]) to graph log volume over time.'
      ),
    },
  ];
};

/** A parser stage is the last thing in the pipeline — suggest filtering/aggregating by extracted labels. */
const parserNextSteps: DiagnosticRule = (graph) => {
  const root = graph.nodes[graph.rootId];
  if (!root || root.kind !== QueryFlowNodeKind.Parser) {
    return [];
  }
  return [
    {
      id: `logql-suggest-parse:${root.id}`,
      nodeId: root.id,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.logql-suggest-parse',
        'After parsing, filter with | label="..." or aggregate by the extracted labels.'
      ),
    },
  ];
};

export const logqlSuggestionRules: DiagnosticRule[] = [logNeedsLineFilter, logCanBecomeMetric, parserNextSteps];

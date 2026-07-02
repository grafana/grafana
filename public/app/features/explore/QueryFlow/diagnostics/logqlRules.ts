import { t } from '@grafana/i18n';

import { QueryFlowNodeKind } from '../model/types';

import { type DiagnosticRule, type QueryFlowDiagnostic } from './types';
import { callArg, sliceSpan } from './util';

// LogQL range aggregation operators — each wraps a log range `[..]`.
const LOKI_RANGE_OPS: ReadonlySet<string> = new Set([
  'rate',
  'rate_counter',
  'count_over_time',
  'bytes_rate',
  'bytes_over_time',
  'sum_over_time',
  'avg_over_time',
  'max_over_time',
  'min_over_time',
  'first_over_time',
  'last_over_time',
  'stddev_over_time',
  'stdvar_over_time',
  'quantile_over_time',
  'absent_over_time',
]);

// Range ops that compute over an extracted numeric label and therefore need `| unwrap`.
const UNWRAP_REQUIRED: ReadonlySet<string> = new Set([
  'sum_over_time',
  'avg_over_time',
  'max_over_time',
  'min_over_time',
  'first_over_time',
  'last_over_time',
  'stddev_over_time',
  'stdvar_over_time',
  'quantile_over_time',
]);

/** Range aggregations must wrap a log range selector `[..]`. */
const rangeAggregationNeedsRange: DiagnosticRule = (graph, expr) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Function || !LOKI_RANGE_OPS.has(node.label)) {
      continue;
    }
    // The mapper always inserts a Range child, marking it `synthetic` when `[..]` is missing — check
    // that flag rather than scanning source text, which would also match `[` inside a selector or
    // regex value (e.g. `rate({msg="foo[bar]"})`).
    const rangeChild = node.childIds
      .map((childId) => graph.nodes[childId])
      .find((child) => child?.kind === QueryFlowNodeKind.Range);
    if (rangeChild && !rangeChild.synthetic) {
      continue;
    }
    const arg = callArg(expr, node.span) || '{}';
    out.push({
      id: `logql-range:${id}`,
      nodeId: id,
      severity: 'error',
      message: t('explore.query-flow.diagnostics.logql-range', '{{fn}} expects a log stream with a time range.', {
        fn: node.label,
      }),
      suggestion: `${node.label}(${arg}[5m])`,
    });
  }
  return out;
};

/** Numeric range aggregations need an `| unwrap` to extract the value. */
const unwrapRequired: DiagnosticRule = (graph, expr) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Function || !UNWRAP_REQUIRED.has(node.label)) {
      continue;
    }
    if (sliceSpan(expr, node.span).includes('unwrap')) {
      continue;
    }
    out.push({
      id: `logql-unwrap:${id}`,
      nodeId: id,
      severity: 'warning',
      message: t(
        'explore.query-flow.diagnostics.logql-unwrap',
        '{{fn}} needs an | unwrap <label> to extract a numeric value from the log line.',
        { fn: node.label }
      ),
    });
  }
  return out;
};

export const logqlRules: DiagnosticRule[] = [rangeAggregationNeedsRange, unwrapRequired];

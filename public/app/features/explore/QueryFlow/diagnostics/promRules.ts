import { t } from '@grafana/i18n';

import { QueryFlowNodeKind } from '../model/types';

import { type DiagnosticRule, type QueryFlowDiagnostic } from './types';
import { callArg, descendants, isRangeVectorFn } from './util';

/** Range-vector functions whose child is an instant vector (no `[..]` range). */
const rangeVectorNeedsRange: DiagnosticRule = (graph, expr) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Function || !isRangeVectorFn(node.label)) {
      continue;
    }
    const child = node.childIds.map((childId) => graph.nodes[childId]).find(Boolean);
    if (!child || child.kind === QueryFlowNodeKind.Range) {
      continue;
    }
    const arg = callArg(expr, node.span) || child.label;
    out.push({
      id: `prom-range-vector:${id}`,
      nodeId: id,
      severity: 'error',
      message: t('explore.query-flow.diagnostics.prom-range-vector', '{{fn}} expects a metric with a time range.', {
        fn: node.label,
      }),
      suggestion: `${node.label}(${arg}[5m])`,
    });
  }
  return out;
};

/** histogram_quantile should be fed *_bucket series. */
const histogramQuantileBuckets: DiagnosticRule = (graph) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Function || node.label !== 'histogram_quantile') {
      continue;
    }
    const hasBuckets = descendants(graph, id).some(
      (descendant) => descendant.kind === QueryFlowNodeKind.Selector && descendant.label.endsWith('_bucket')
    );
    if (!hasBuckets) {
      // Can't distinguish "wrong metric" from "native histogram" (no `_bucket` metric to inspect)
      // without live metadata, so this stays a soft tip rather than an error/warning.
      out.push({
        id: `prom-histogram-quantile:${id}`,
        nodeId: id,
        severity: 'tip',
        message: t(
          'explore.query-flow.diagnostics.prom-histogram-quantile',
          'histogram_quantile usually expects classic histogram buckets (a _bucket metric grouped by le) — ignore this if you\u2019re using a native histogram.'
        ),
      });
    }
  }
  return out;
};

/** Aggregations are clearer when grouped with by()/without(). */
const aggregationGrouping: DiagnosticRule = (graph) => {
  const out: QueryFlowDiagnostic[] = [];
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.kind !== QueryFlowNodeKind.Aggregation || node.sublabel) {
      continue;
    }
    out.push({
      id: `prom-aggregation-grouping:${id}`,
      nodeId: id,
      severity: 'tip',
      message: t(
        'explore.query-flow.diagnostics.prom-aggregation-grouping',
        'Consider grouping {{op}} with by() or without() to keep meaningful labels.',
        { op: node.label }
      ),
    });
  }
  return out;
};

export const promRules: DiagnosticRule[] = [rangeVectorNeedsRange, histogramQuantileBuckets, aggregationGrouping];

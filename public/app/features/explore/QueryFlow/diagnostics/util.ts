import { type QueryFlowGraph, type QueryFlowNode, type SourceSpan } from '../model/types';

// Prometheus functions that operate on a range vector and therefore require a `[..]` range selector.
// Shared between promRules (lint) and suggestions (tips) so the two lists can't drift apart.
export const RANGE_VECTOR_FNS: ReadonlySet<string> = new Set([
  'rate',
  'irate',
  'increase',
  'delta',
  'idelta',
  'deriv',
  'predict_linear',
  'holt_winters',
  'double_exponential_smoothing',
  'resets',
  'changes',
]);

export function isRangeVectorFn(label: string): boolean {
  return RANGE_VECTOR_FNS.has(label) || label.endsWith('_over_time');
}

/** Original query text a span covers. */
export function sliceSpan(expr: string, span: SourceSpan): string {
  return expr.slice(span.from, span.to);
}

/**
 * The argument text inside a call node's parentheses, e.g. `rate(foo[5m])` -> `foo[5m]`. Tolerates a
 * missing closing paren (incomplete query mid-edit) by taking everything after the first `(`.
 */
export function callArg(expr: string, span: SourceSpan): string {
  const text = sliceSpan(expr, span);
  const open = text.indexOf('(');
  if (open < 0) {
    return '';
  }
  const close = text.lastIndexOf(')');
  const inner = close > open ? text.slice(open + 1, close) : text.slice(open + 1);
  return inner.trim();
}

/**
 * All transitive parents of a node, nearest first (excluding the node itself). Edges are stored as
 * parent `childIds`, so we invert them into a child->parent map and walk up.
 */
export function ancestors(graph: QueryFlowGraph, nodeId: string): QueryFlowNode[] {
  const parentOf = new Map<string, string>();
  for (const id of Object.keys(graph.nodes)) {
    for (const childId of graph.nodes[id].childIds) {
      parentOf.set(childId, id);
    }
  }
  const out: QueryFlowNode[] = [];
  const seen = new Set<string>([nodeId]);
  let current = parentOf.get(nodeId);
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = graph.nodes[current];
    if (!node) {
      break;
    }
    out.push(node);
    current = parentOf.get(current);
  }
  return out;
}

/** All transitive children of a node (excluding the node itself). */
export function descendants(graph: QueryFlowGraph, nodeId: string): QueryFlowNode[] {
  const out: QueryFlowNode[] = [];
  const seen = new Set<string>([nodeId]);
  const queue = [...(graph.nodes[nodeId]?.childIds ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const node = graph.nodes[id];
    if (!node) {
      continue;
    }
    out.push(node);
    queue.push(...node.childIds);
  }
  return out;
}

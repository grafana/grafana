import { type SyntaxNode } from '@lezer/common';
import { parser as promParser } from '@prometheus-io/lezer-promql';

import { t } from '@grafana/i18n';

import {
  assembleGraph,
  collectParseErrors,
  emitUnknown,
  emptyGraph,
  GraphContext,
  handleBinaryExpr,
  type QueryFlowMapper,
} from '../mapper';
import { childrenOf, childrenOfType, firstChildOfType } from '../treeUtils';
import { QueryFlowNodeKind, type QueryFlowParam } from '../types';
import { replaceVariables } from '../variables';

const EXPR_NAMES: ReadonlySet<string> = new Set([
  'AggregateExpr',
  'FunctionCall',
  'BinaryExpr',
  'MatrixSelector',
  'VectorSelector',
  'ParenExpr',
  'SubqueryExpr',
  'UnaryExpr',
  'OffsetExpr',
  'StepInvariantExpr',
  'NumberDurationLiteral',
  'StringLiteral',
]);

const LITERALS: ReadonlySet<string> = new Set(['NumberDurationLiteral', 'StringLiteral']);
const MATCHER_NAMES: ReadonlySet<string> = new Set(['UnquotedLabelMatcher', 'QuotedLabelMatcher']);
const METRIC_NAMES: ReadonlySet<string> = new Set(['Identifier', 'MetricName']);

export const promqlMapper: QueryFlowMapper = {
  language: 'promql',
  buildGraph(expr) {
    if (!expr.trim()) {
      return emptyGraph('promql');
    }
    const { replaced, map } = replaceVariables(expr);
    const ctx = new GraphContext(expr, map, 'promql');
    const tree = promParser.parse(replaced);

    let rootId: string | undefined;
    try {
      rootId = handle(ctx, tree.topNode);
    } catch (err) {
      ctx.errors.push({
        message: err instanceof Error ? err.message : t('explore.query-flow.parse-failed', 'Failed to parse query'),
      });
    }
    collectParseErrors(ctx, tree);
    return assembleGraph(ctx, rootId);
  },
};

function handle(ctx: GraphContext, node: SyntaxNode): string | undefined {
  switch (node.type.name) {
    case 'PromQL':
    case 'ParenExpr': // precedence wrapper — not flow-meaningful
    case 'UnaryExpr':
      return handleChildExpr(ctx, node);
    case 'StepInvariantExpr': // @ modifier
    case 'OffsetExpr':
      return handleModifier(ctx, node);
    case 'AggregateExpr':
      return handleAggregate(ctx, node);
    case 'FunctionCall':
      return handleFunctionCall(ctx, node);
    case 'BinaryExpr':
      return handleBinary(ctx, node);
    case 'MatrixSelector':
    case 'SubqueryExpr':
      return handleRange(ctx, node);
    case 'VectorSelector':
      return handleVectorSelector(ctx, node);
    case 'NumberDurationLiteral':
    case 'StringLiteral':
      return handleLiteral(ctx, node);
    default:
      return handleChildExpr(ctx, node) ?? emitUnknown(ctx, node);
  }
}

function handleChildExpr(ctx: GraphContext, node: SyntaxNode): string | undefined {
  const child = firstChildOfType(node, EXPR_NAMES);
  return child ? handle(ctx, child) : undefined;
}

function handleVectorSelector(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const metricNode = firstChildOfType(node, METRIC_NAMES);
  const matchersNode = firstChildOfType(node, 'LabelMatchers');
  const params = matchersNode
    ? childrenOfType(matchersNode, MATCHER_NAMES).map((matcher): QueryFlowParam => {
        const labelName = firstChildOfType(matcher, 'LabelName');
        return {
          key: labelName ? ctx.text(labelName) : undefined,
          value: ctx.text(matcher),
          span: ctx.origSpan(matcher),
        };
      })
    : [];
  return ctx.addNode({
    id: ctx.makeId('selector', span),
    kind: QueryFlowNodeKind.Selector,
    label: metricNode ? ctx.text(metricNode) : ctx.sliceOriginal(span),
    params,
    span,
    childIds: [],
  });
}

function handleRange(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const inner = firstChildOfType(node, EXPR_NAMES);
  const innerId = inner ? handle(ctx, inner) : undefined;
  // The range/subquery token (`[5m]`, `[$__rate_interval]`, `[5m:1m]`) is the text after the inner expr.
  const innerSpan = inner ? ctx.origSpan(inner) : span;
  const rangeText = ctx.sliceOriginal({ from: innerSpan.to, to: span.to }).trim();
  return ctx.addNode({
    id: ctx.makeId('range', span),
    kind: QueryFlowNodeKind.Range,
    label: rangeText || 'range',
    span,
    childIds: innerId ? [innerId] : [],
  });
}

/**
 * `offset 5m` / `@ start()` / `@ 1609746000` — the modifier keyword+value trails the inner
 * expression, so (like `handleRange`) its text is whatever's left after the inner expr's span.
 * Represented as its own node (rather than folded into the inner expr) so the modifier isn't
 * silently dropped from the graph.
 */
function handleModifier(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const inner = firstChildOfType(node, EXPR_NAMES);
  const innerId = inner ? handle(ctx, inner) : undefined;
  const innerSpan = inner ? ctx.origSpan(inner) : span;
  const modifierText = ctx.sliceOriginal({ from: innerSpan.to, to: span.to }).trim();
  return ctx.addNode({
    id: ctx.makeId('modifier', span),
    kind: QueryFlowNodeKind.Modifier,
    label: modifierText || 'modifier',
    span,
    childIds: innerId ? [innerId] : [],
  });
}

function handleFunctionCall(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const idNode = firstChildOfType(node, 'FunctionIdentifier');
  const body = firstChildOfType(node, 'FunctionCallBody');
  const { childIds, params } = collectArgs(ctx, body);
  return ctx.addNode({
    id: ctx.makeId('function', span),
    kind: QueryFlowNodeKind.Function,
    label: idNode ? ctx.text(idNode) : 'function',
    params,
    span,
    childIds,
  });
}

function handleAggregate(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const opNode = firstChildOfType(node, 'AggregateOp');
  const modifierNode = firstChildOfType(node, 'AggregateModifier');
  const body = firstChildOfType(node, 'FunctionCallBody');
  const { childIds, params } = collectArgs(ctx, body);
  return ctx.addNode({
    id: ctx.makeId('aggregation', span),
    kind: QueryFlowNodeKind.Aggregation,
    label: opNode ? ctx.text(opNode) : 'aggregation',
    sublabel: modifierNode ? ctx.text(modifierNode) : undefined,
    params,
    span,
    childIds,
  });
}

function handleBinary(ctx: GraphContext, node: SyntaxNode): string {
  return handleBinaryExpr(ctx, node, EXPR_NAMES, 'MatchingModifierClause', handle);
}

function handleLiteral(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  return ctx.addNode({
    id: ctx.makeId('literal', span),
    kind: QueryFlowNodeKind.Literal,
    label: ctx.text(node),
    span,
    childIds: [],
  });
}

/** Literal arguments become params; expression arguments become child nodes. */
function collectArgs(
  ctx: GraphContext,
  body: SyntaxNode | undefined
): { childIds: string[]; params: QueryFlowParam[] } {
  const childIds: string[] = [];
  const params: QueryFlowParam[] = [];
  if (!body) {
    return { childIds, params };
  }
  for (const arg of childrenOf(body)) {
    if (!EXPR_NAMES.has(arg.type.name)) {
      continue;
    }
    if (LITERALS.has(arg.type.name)) {
      params.push({ value: ctx.text(arg), span: ctx.origSpan(arg) });
    } else {
      const id = handle(ctx, arg);
      if (id) {
        childIds.push(id);
      }
    }
  }
  return { childIds, params };
}

import { type SyntaxNode } from '@lezer/common';

import { t } from '@grafana/i18n';
import { parser as logqlParser } from '@grafana/lezer-logql';

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
  'MetricExpr',
  'LogExpr',
  'VectorAggregationExpr',
  'RangeAggregationExpr',
  'BinOpExpr',
  'LiteralExpr',
  'VectorExpr',
  'LabelReplaceExpr',
]);

/** Structural nodes `handle` knows how to descend into (wrappers + expressions + selector). */
const HANDLEABLE: ReadonlySet<string> = new Set([...EXPR_NAMES, 'LogQL', 'Expr', 'Selector', 'LogRangeExpr']);

const MATCHER_NAMES: ReadonlySet<string> = new Set(['Matcher']);

export const logqlMapper: QueryFlowMapper = {
  language: 'logql',
  buildGraph(expr) {
    if (!expr.trim()) {
      return emptyGraph('logql');
    }
    const { replaced, map } = replaceVariables(expr);
    const ctx = new GraphContext(expr, map, 'logql');
    const tree = logqlParser.parse(replaced);

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
    case 'LogQL':
    case 'Expr':
    case 'MetricExpr':
    case 'VectorExpr':
      return handleChildExpr(ctx, node);
    case 'VectorAggregationExpr':
      return handleVectorAggregation(ctx, node);
    case 'RangeAggregationExpr':
      return handleRangeAggregation(ctx, node);
    case 'LogRangeExpr':
      return handleLogRange(ctx, node);
    case 'LogExpr':
      return buildLogChain(ctx, node);
    case 'BinOpExpr':
      return handleBinary(ctx, node);
    case 'LabelReplaceExpr':
      return handleLabelReplace(ctx, node);
    case 'LiteralExpr':
      return handleLiteral(ctx, node);
    case 'Selector':
      return handleSelector(ctx, node);
    default:
      return handleChildExpr(ctx, node) ?? emitUnknown(ctx, node);
  }
}

function handleChildExpr(ctx: GraphContext, node: SyntaxNode): string | undefined {
  const child = firstChildOfType(node, HANDLEABLE);
  return child ? handle(ctx, child) : undefined;
}

function handleVectorAggregation(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const opNode = firstChildOfType(node, 'VectorOp');
  const groupingNode = firstChildOfType(node, 'Grouping');
  const inner = firstChildOfType(node, EXPR_NAMES);
  const childId = inner ? handle(ctx, inner) : undefined;
  return ctx.addNode({
    id: ctx.makeId('aggregation', span),
    kind: QueryFlowNodeKind.Aggregation,
    label: opNode ? ctx.text(opNode) : 'aggregation',
    sublabel: groupingNode ? ctx.text(groupingNode) : undefined,
    span,
    childIds: childId ? [childId] : [],
  });
}

function handleRangeAggregation(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const opNode = firstChildOfType(node, 'RangeOp');
  const groupingNode = firstChildOfType(node, 'Grouping');
  const logRange = firstChildOfType(node, 'LogRangeExpr');
  const childId = logRange ? handle(ctx, logRange) : undefined;
  return ctx.addNode({
    id: ctx.makeId('function', span),
    kind: QueryFlowNodeKind.Function,
    label: opNode ? ctx.text(opNode) : 'function',
    sublabel: groupingNode ? ctx.text(groupingNode) : undefined,
    span,
    childIds: childId ? [childId] : [],
  });
}

function handleLogRange(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const chainId = buildLogChain(ctx, node);
  const rangeNode = firstChildOfType(node, 'Range');
  return ctx.addNode({
    id: ctx.makeId('range', span),
    kind: QueryFlowNodeKind.Range,
    label: rangeNode ? ctx.text(rangeNode) : 'range',
    span,
    childIds: chainId ? [chainId] : [],
    // The grammar recovers a missing `[..]` with an empty Range placeholder (e.g. in
    // `rate({job="app"})`), so callers that need to know whether a range was actually written must
    // check this flag rather than scanning the source text for `[`.
    synthetic: !rangeNode,
  });
}

/** Selector → pipeline stages, chained so each stage's child is the previous step (data flows up). */
function buildLogChain(ctx: GraphContext, node: SyntaxNode): string | undefined {
  const selectorNode = firstChildOfType(node, 'Selector');
  let prevId = selectorNode ? handleSelector(ctx, selectorNode) : undefined;

  const pipeline = firstChildOfType(node, 'PipelineExpr');
  if (pipeline) {
    for (const stage of collectStages(pipeline)) {
      // childIds is set at creation (not mutated afterwards), matching the pattern every other
      // handler in this file follows.
      prevId = handleStage(ctx, stage, prevId);
    }
  }

  // `| unwrap <label>` is a sibling of PipelineExpr under LogRangeExpr (not itself a PipelineStage),
  // so it needs its own step here — otherwise it's silently dropped from the graph.
  const unwrap = firstChildOfType(node, 'UnwrapExpr');
  if (unwrap) {
    prevId = handleUnwrap(ctx, unwrap, prevId);
  }

  return prevId;
}

/** `| unwrap <label>` extracts a numeric value from a label to feed a range aggregation. */
function handleUnwrap(ctx: GraphContext, node: SyntaxNode, childId: string | undefined): string {
  const span = ctx.origSpan(node);
  return ctx.addNode({
    id: ctx.makeId(QueryFlowNodeKind.Parser, span),
    kind: QueryFlowNodeKind.Parser,
    label: ctx.text(node).trim(),
    span,
    childIds: childId ? [childId] : [],
  });
}

/** PipelineExpr is left-nested; pre-order DFS yields the stages in source order. */
function collectStages(pipeline: SyntaxNode): SyntaxNode[] {
  const stages: SyntaxNode[] = [];
  const walk = (node: SyntaxNode) => {
    for (const child of childrenOf(node)) {
      if (child.type.name === 'PipelineStage') {
        stages.push(child);
      } else if (child.type.name === 'PipelineExpr') {
        walk(child);
      }
    }
  };
  walk(pipeline);
  return stages;
}

function handleStage(ctx: GraphContext, stage: SyntaxNode, childId: string | undefined): string {
  const span = ctx.origSpan(stage);
  const content = childrenOf(stage).find((child) => child.type.name !== 'Pipe');
  const name = content?.type.name;
  const label = ctx.text(content ?? stage).trim();

  let kind = QueryFlowNodeKind.Unknown;
  switch (name) {
    case 'LineFilters':
    case 'LineFilter':
      kind = QueryFlowNodeKind.LineFilter;
      break;
    case 'LabelParser':
    case 'JsonExpressionParser':
    case 'LogfmtParser':
    case 'LogfmtExpressionParser':
    case 'DecolorizeExpr':
    case 'DropLabelsExpr':
    case 'KeepLabelsExpr':
      kind = QueryFlowNodeKind.Parser;
      break;
    case 'LabelFilter':
      kind = QueryFlowNodeKind.LabelFilter;
      break;
    case 'LineFormatExpr':
    case 'LabelFormatExpr':
      kind = QueryFlowNodeKind.LabelFormat;
      break;
    default:
      kind = QueryFlowNodeKind.Unknown;
  }

  return ctx.addNode({
    id: ctx.makeId(kind, span),
    kind,
    label: label || name || 'stage',
    span,
    childIds: childId ? [childId] : [],
  });
}

function handleSelector(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const matchersNode = firstChildOfType(node, 'Matchers');
  const params = matchersNode
    ? childrenOfType(matchersNode, MATCHER_NAMES).map((matcher): QueryFlowParam => {
        const identifier = firstChildOfType(matcher, 'Identifier');
        return {
          key: identifier ? ctx.text(identifier) : undefined,
          value: ctx.text(matcher),
          span: ctx.origSpan(matcher),
        };
      })
    : [];
  return ctx.addNode({
    id: ctx.makeId('selector', span),
    kind: QueryFlowNodeKind.Selector,
    label: ctx.text(node),
    params,
    span,
    childIds: [],
  });
}

function handleLabelReplace(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const inner = firstChildOfType(node, EXPR_NAMES);
  const childId = inner ? handle(ctx, inner) : undefined;
  return ctx.addNode({
    id: ctx.makeId('function', span),
    kind: QueryFlowNodeKind.Function,
    label: ctx.text(node).split('(')[0].trim(),
    span,
    childIds: childId ? [childId] : [],
  });
}

function handleBinary(ctx: GraphContext, node: SyntaxNode): string {
  // BinOpExpr's direct operand children are typed `Expr` (a wrapper around the actual MetricExpr
  // etc.), not one of EXPR_NAMES directly — use HANDLEABLE (which includes `Expr`) so operands are
  // actually found. Using EXPR_NAMES here silently dropped both operands (bug predates this comment).
  return handleBinaryExpr(ctx, node, HANDLEABLE, 'OnOrIgnoringModifier', handle);
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

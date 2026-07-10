import { type SyntaxNode, type Tree } from '@lezer/common';

import { t } from '@grafana/i18n';

import { childrenOf, firstChildOfType } from './treeUtils';
import {
  type QueryFlowGraph,
  type QueryFlowLanguage,
  type QueryFlowNode,
  QueryFlowNodeKind,
  type QueryFlowParseError,
  type SourceSpan,
} from './types';
import { mapSpanToOriginal, type VarSpanMap } from './variables';

// Binary operators are lexically identical across PromQL and LogQL grammars, so both language
// walkers share this set instead of keeping two copies in sync.
export const BINARY_OPS: ReadonlySet<string> = new Set([
  'Add',
  'Sub',
  'Mul',
  'Div',
  'Mod',
  'Pow',
  'Eql',
  'Neq',
  'Gtr',
  'Lss',
  'Gte',
  'Lte',
  'And',
  'Or',
  'Unless',
]);

export interface QueryFlowMapper {
  language: QueryFlowLanguage;
  /** Parse `expr` into a graph. Never throws — failures are surfaced via `graph.errors`. */
  buildGraph(expr: string): QueryFlowGraph;
}

/** Mutable accumulator a language walker fills while building one graph. */
export class GraphContext {
  nodes: Record<string, QueryFlowNode> = {};
  errors: QueryFlowParseError[] = [];

  constructor(
    public readonly originalExpr: string,
    public readonly varMap: VarSpanMap,
    public readonly language: QueryFlowLanguage
  ) {}

  /** Span of a parsed node mapped back into original (pre variable-replace) coordinates. */
  origSpan(node: SyntaxNode): SourceSpan {
    return mapSpanToOriginal({ from: node.from, to: node.to }, this.varMap);
  }

  /** Original text a node covers, with template variables intact. */
  text(node: SyntaxNode): string {
    const span = this.origSpan(node);
    return this.originalExpr.slice(span.from, span.to);
  }

  sliceOriginal(span: SourceSpan): string {
    return this.originalExpr.slice(span.from, span.to);
  }

  addNode(node: Omit<QueryFlowNode, 'language'>): string {
    if (process.env.NODE_ENV !== 'production') {
      const existing = this.nodes[node.id];
      // Ids are derived from `kind:span`, so a collision usually means two different subtrees
      // produced the same id — most likely a mapper bug. Same-content re-adds (idempotent re-parse
      // of an already-visited node) are common and fine, so only warn when the content differs.
      if (existing && (existing.kind !== node.kind || existing.label !== node.label)) {
        // eslint-disable-next-line no-console
        console.warn(
          `QueryFlow: node id "${node.id}" collided with a different node (kind/label mismatch). ` +
            'This usually means two mapper handlers derived the same id for different subtrees.'
        );
      }
    }
    this.nodes[node.id] = { ...node, language: this.language };
    return node.id;
  }

  makeId(kind: string, span: SourceSpan): string {
    return `${kind}:${span.from}-${span.to}`;
  }
}

export function emptyGraph(language: QueryFlowLanguage): QueryFlowGraph {
  return { language, rootId: '', nodes: {}, errors: [] };
}

export function assembleGraph(ctx: GraphContext, rootId: string | undefined): QueryFlowGraph {
  const graph: QueryFlowGraph = {
    language: ctx.language,
    rootId: rootId ?? '',
    nodes: ctx.nodes,
    errors: ctx.errors,
  };
  if (process.env.NODE_ENV !== 'production') {
    validateGraph(graph);
  }
  return graph;
}

/**
 * Dev-only sanity check: every `childId` should resolve to a node in the graph, and every node
 * should be reachable from the root — the layout and canvas only ever walk the tree via `childIds`
 * starting at `rootId`, so an unreachable node is otherwise a silent no-op rather than a visible bug.
 */
function validateGraph(graph: QueryFlowGraph): void {
  for (const id of Object.keys(graph.nodes)) {
    for (const childId of graph.nodes[id].childIds) {
      if (!graph.nodes[childId]) {
        // eslint-disable-next-line no-console
        console.warn(`QueryFlow: node "${id}" references missing child "${childId}".`);
      }
    }
  }
  if (!graph.rootId) {
    return;
  }
  const reachable = new Set<string>();
  const queue = graph.nodes[graph.rootId] ? [graph.rootId] : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) {
      continue;
    }
    reachable.add(id);
    queue.push(...(graph.nodes[id]?.childIds ?? []));
  }
  for (const id of Object.keys(graph.nodes)) {
    if (!reachable.has(id)) {
      // eslint-disable-next-line no-console
      console.warn(`QueryFlow: node "${id}" is unreachable from the graph root and will never render.`);
    }
  }
}

/**
 * Shared binary-expression handler: PromQL and LogQL grammars both wrap a binary op node plus an
 * optional matching-modifier clause (`on(...)`/`ignoring(...)`) around two operands. `exprNames`
 * and `modifierType` are the only language-specific inputs; `handle` is the language's own
 * recursive dispatcher so operands route back through its full node-kind switch.
 */
export function handleBinaryExpr(
  ctx: GraphContext,
  node: SyntaxNode,
  exprNames: ReadonlySet<string>,
  modifierType: string,
  handle: (ctx: GraphContext, node: SyntaxNode) => string | undefined
): string {
  const span = ctx.origSpan(node);
  const children = childrenOf(node);
  const opNode = children.find((child) => BINARY_OPS.has(child.type.name));
  const modifierNode = firstChildOfType(node, modifierType);
  const childIds = children
    .filter((child) => exprNames.has(child.type.name))
    .map((operand) => handle(ctx, operand))
    .filter((id): id is string => Boolean(id));
  return ctx.addNode({
    id: ctx.makeId('binary', span),
    kind: QueryFlowNodeKind.Binary,
    label: opNode ? ctx.text(opNode) : 'binary',
    sublabel: modifierNode ? ctx.text(modifierNode) : undefined,
    span,
    childIds,
  });
}

/** Graceful fallback for a subtree the walker doesn't have a specific handler for. */
export function emitUnknown(ctx: GraphContext, node: SyntaxNode): string {
  const span = ctx.origSpan(node);
  const text = ctx.text(node);
  return ctx.addNode({
    id: ctx.makeId('unknown', span),
    kind: QueryFlowNodeKind.Unknown,
    label: text.length > 40 ? `${text.slice(0, 40)}…` : text,
    span,
    childIds: [],
  });
}

/**
 * Record syntax errors, except those a template variable caused. A variable in a duration position
 * (e.g. `[$__rate_interval]`) produces an unparsable token, but the surrounding structure is still
 * recognized and handled — flagging it would mislead the user about an otherwise valid query.
 */
export function collectParseErrors(ctx: GraphContext, tree: Tree): void {
  const cursor = tree.cursor();
  do {
    if (!cursor.type.isError) {
      continue;
    }
    const { from, to } = cursor;
    const nearVariable = ctx.varMap.segments.some((seg) => seg.repFrom <= to && from <= seg.repTo);
    if (nearVariable) {
      continue;
    }
    ctx.errors.push({
      message: t('explore.query-flow.unexpected-token', 'Unexpected token'),
      span: mapSpanToOriginal({ from, to }, ctx.varMap),
    });
  } while (cursor.next());
}

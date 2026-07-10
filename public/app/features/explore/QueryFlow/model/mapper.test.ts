import { parser as promParser } from '@prometheus-io/lezer-promql';

import { assembleGraph, collectParseErrors, emitUnknown, GraphContext, handleBinaryExpr } from './mapper';
import { QueryFlowNodeKind } from './types';
import { replaceVariables } from './variables';

function makeCtx(expr: string) {
  const { replaced, map } = replaceVariables(expr);
  return { ctx: new GraphContext(expr, map, 'promql' as const), replaced };
}

describe('GraphContext', () => {
  it('origSpan/text/sliceOriginal round-trip through a variable-replaced expression', () => {
    const { ctx, replaced } = makeCtx('rate(x[$__rate_interval])');
    const tree = promParser.parse(replaced);
    // The whole tree's span should map back to the full original text.
    const span = ctx.origSpan(tree.topNode);
    expect(span).toEqual({ from: 0, to: 'rate(x[$__rate_interval])'.length });
    expect(ctx.text(tree.topNode)).toBe('rate(x[$__rate_interval])');
    expect(ctx.sliceOriginal({ from: 5, to: 6 })).toBe('x');
  });

  it('makeId derives a stable id from kind and span', () => {
    const { ctx } = makeCtx('x');
    expect(ctx.makeId('selector', { from: 0, to: 3 })).toBe('selector:0-3');
  });
});

describe('collectParseErrors', () => {
  it('records a real syntax error with its mapped span', () => {
    const { ctx, replaced } = makeCtx('sum(rate(metric[5m])');
    const tree = promParser.parse(replaced);
    collectParseErrors(ctx, tree);
    expect(ctx.errors.length).toBeGreaterThan(0);
    expect(ctx.errors[0].message).toBeTruthy();
  });

  it('suppresses an error caused by a variable placeholder', () => {
    // $__rate_interval inside a duration position produces an unparsable token, but the query is
    // otherwise valid — flagging it would mislead the user.
    const { ctx, replaced } = makeCtx('rate(metric[$__rate_interval])');
    const tree = promParser.parse(replaced);
    collectParseErrors(ctx, tree);
    expect(ctx.errors).toHaveLength(0);
  });

  it('does not record anything for a query with no errors', () => {
    const { ctx, replaced } = makeCtx('rate(metric[5m])');
    const tree = promParser.parse(replaced);
    collectParseErrors(ctx, tree);
    expect(ctx.errors).toHaveLength(0);
  });
});

describe('assembleGraph', () => {
  it('preserves rootId/nodes/errors', () => {
    const { ctx } = makeCtx('x');
    ctx.addNode({ id: 'a', kind: QueryFlowNodeKind.Selector, label: 'a', span: { from: 0, to: 1 }, childIds: ['b'] });
    ctx.addNode({ id: 'b', kind: QueryFlowNodeKind.Selector, label: 'b', span: { from: 1, to: 2 }, childIds: [] });

    const graph = assembleGraph(ctx, 'a');

    expect(graph.rootId).toBe('a');
    expect(graph.nodes).toBe(ctx.nodes);
    expect(graph.errors).toBe(ctx.errors);
  });

  it('defaults rootId to an empty string when nothing parsed', () => {
    const { ctx } = makeCtx('');
    const graph = assembleGraph(ctx, undefined);
    expect(graph.rootId).toBe('');
  });

  it('warns (dev-only) when a node references a childId that does not exist', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx } = makeCtx('x');
    ctx.addNode({
      id: 'a',
      kind: QueryFlowNodeKind.Selector,
      label: 'a',
      span: { from: 0, to: 1 },
      childIds: ['missing'],
    });

    assembleGraph(ctx, 'a');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('references missing child'));
    warn.mockRestore();
  });

  it('warns (dev-only) about a node that is unreachable from the root', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx } = makeCtx('x');
    ctx.addNode({ id: 'a', kind: QueryFlowNodeKind.Selector, label: 'a', span: { from: 0, to: 1 }, childIds: [] });
    ctx.addNode({ id: 'orphan', kind: QueryFlowNodeKind.Selector, label: 'o', span: { from: 1, to: 2 }, childIds: [] });

    assembleGraph(ctx, 'a');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unreachable from the graph root'));
    warn.mockRestore();
  });

  it('does not warn for a well-formed, fully-reachable graph', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx } = makeCtx('x');
    ctx.addNode({ id: 'a', kind: QueryFlowNodeKind.Selector, label: 'a', span: { from: 0, to: 1 }, childIds: ['b'] });
    ctx.addNode({ id: 'b', kind: QueryFlowNodeKind.Selector, label: 'b', span: { from: 1, to: 2 }, childIds: [] });

    assembleGraph(ctx, 'a');

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('GraphContext.addNode', () => {
  it('warns (dev-only) when the same id is reused for a node with a different kind/label', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx } = makeCtx('x');

    ctx.addNode({
      id: 'dup',
      kind: QueryFlowNodeKind.Selector,
      label: 'first',
      span: { from: 0, to: 1 },
      childIds: [],
    });
    ctx.addNode({
      id: 'dup',
      kind: QueryFlowNodeKind.Function,
      label: 'second',
      span: { from: 0, to: 1 },
      childIds: [],
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('collided with a different node'));
    warn.mockRestore();
  });

  it('does not warn when the exact same node is re-added (idempotent re-visit)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx } = makeCtx('x');

    const node = { id: 'same', kind: QueryFlowNodeKind.Selector, label: 'a', span: { from: 0, to: 1 }, childIds: [] };
    ctx.addNode(node);
    ctx.addNode(node);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('emitUnknown', () => {
  it('truncates long text with an ellipsis and keeps short text intact', () => {
    const { ctx } = makeCtx('x'.repeat(50));
    const tree = promParser.parse('x'.repeat(50));
    const id = emitUnknown(ctx, tree.topNode);
    expect(ctx.nodes[id].kind).toBe(QueryFlowNodeKind.Unknown);
    expect(ctx.nodes[id].label.endsWith('…')).toBe(true);
    expect(ctx.nodes[id].label.length).toBe(41);
  });
});

describe('handleBinaryExpr', () => {
  it('finds the operator and matching-modifier clause, and recurses into operands via the passed-in handle', () => {
    const { ctx, replaced } = makeCtx('a + b');
    const tree = promParser.parse(replaced);
    const binaryNode = tree.topNode.getChild('BinaryExpr')!;
    let handleCalls = 0;
    const fakeHandle = (c: GraphContext, n: Parameters<typeof handleBinaryExpr>[1]) => {
      handleCalls++;
      return c.addNode({
        id: c.makeId('selector', c.origSpan(n)),
        kind: QueryFlowNodeKind.Selector,
        label: c.text(n),
        span: c.origSpan(n),
        childIds: [],
      });
    };
    const exprNames = new Set(['VectorSelector']);

    const id = handleBinaryExpr(ctx, binaryNode, exprNames, 'MatchingModifierClause', fakeHandle);

    expect(ctx.nodes[id].kind).toBe(QueryFlowNodeKind.Binary);
    expect(ctx.nodes[id].label).toBe('+');
    expect(ctx.nodes[id].childIds).toHaveLength(2);
    expect(handleCalls).toBe(2);
  });
});

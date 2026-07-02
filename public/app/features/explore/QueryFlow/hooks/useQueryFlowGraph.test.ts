import { renderHook } from '@testing-library/react';

import { useQueryFlowGraph } from './useQueryFlowGraph';

describe('useQueryFlowGraph', () => {
  it('builds a graph for a valid Prometheus query', () => {
    const { result } = renderHook(() => useQueryFlowGraph('sum(rate(metric[5m]))', 'prometheus'));
    expect(result.current.status).toBe('valid');
    expect(result.current.graph?.rootId).toBeTruthy();
  });

  it('reports unsupported datasources', () => {
    const { result } = renderHook(() => useQueryFlowGraph('{ span.name = "x" }', 'tempo'));
    expect(result.current.status).toBe('unsupported');
    expect(result.current.graph).toBeUndefined();
  });

  it('keeps the last valid graph while the query is unparseable mid-edit', () => {
    const { result, rerender } = renderHook(({ expr }) => useQueryFlowGraph(expr, 'prometheus'), {
      initialProps: { expr: 'up' },
    });
    expect(result.current.status).toBe('valid');
    const validGraph = result.current.graph;

    rerender({ expr: ')' });

    expect(result.current.status).toBe('stale');
    expect(result.current.graph).toBe(validGraph);
  });

  it('does not show another datasource\u2019s graph as stale after switching', () => {
    const { result, rerender } = renderHook(
      ({ expr, dsType }: { expr: string; dsType: string }) => useQueryFlowGraph(expr, dsType),
      { initialProps: { expr: 'up', dsType: 'prometheus' } }
    );
    expect(result.current.status).toBe('valid');

    // Same (momentarily unparseable) text, but the pane switched to Loki — the old PromQL graph
    // must not linger as "stale".
    rerender({ expr: ')', dsType: 'loki' });

    expect(result.current.status).toBe('empty');
    expect(result.current.graph).toBeUndefined();
  });

  it('rebuilds immediately as the query changes (no debounce)', () => {
    const { result, rerender } = renderHook(({ expr }) => useQueryFlowGraph(expr, 'prometheus'), {
      initialProps: { expr: 'up' },
    });
    const first = result.current.graph;

    rerender({ expr: 'rate(metric[5m])' });

    expect(result.current.graph).not.toBe(first);
    expect(result.current.status).toBe('valid');
  });
});

import { renderHook } from '@testing-library/react';

import { useSelector } from 'app/types/store';

import { useActiveQueryFlowQuery } from './useActiveQueryFlowQuery';

jest.mock('app/types/store', () => ({
  useSelector: jest.fn(),
}));

function mockState(overrides: {
  queries?: Array<Record<string, unknown>>;
  datasourceInstance?: Record<string, unknown>;
}) {
  (useSelector as jest.Mock).mockImplementation((selector) =>
    selector({
      explore: {
        panes: {
          left: {
            queries: overrides.queries,
            datasourceInstance: overrides.datasourceInstance,
          },
        },
      },
    })
  );
}

describe('useActiveQueryFlowQuery', () => {
  it('reads expr and datasource from the matching query', () => {
    mockState({
      queries: [
        { refId: 'A', expr: 'up', datasource: { type: 'prometheus', uid: 'prom-uid' } },
        { refId: 'B', expr: 'other' },
      ],
    });

    const { result } = renderHook(() => useActiveQueryFlowQuery('left', 'A'));

    expect(result.current).toEqual({
      expr: 'up',
      datasourceType: 'prometheus',
      datasourceUid: 'prom-uid',
    });
  });

  it('falls back to the pane datasource when the query has none of its own', () => {
    mockState({
      queries: [{ refId: 'A', expr: 'up' }],
      datasourceInstance: { type: 'loki', uid: 'loki-uid' },
    });

    const { result } = renderHook(() => useActiveQueryFlowQuery('left', 'A'));

    expect(result.current.datasourceType).toBe('loki');
    expect(result.current.datasourceUid).toBe('loki-uid');
  });

  it('returns an empty expr when the query has been removed', () => {
    mockState({ queries: [{ refId: 'B', expr: 'other' }] });

    const { result } = renderHook(() => useActiveQueryFlowQuery('left', 'A'));

    expect(result.current.expr).toBe('');
  });

  it('returns an empty expr when the pane has no queries at all', () => {
    mockState({ queries: undefined });

    const { result } = renderHook(() => useActiveQueryFlowQuery('left', 'A'));

    expect(result.current.expr).toBe('');
  });

  it('returns an empty expr for a query type with no expr field (e.g. a non-expr datasource)', () => {
    mockState({ queries: [{ refId: 'A' }] });

    const { result } = renderHook(() => useActiveQueryFlowQuery('left', 'A'));

    expect(result.current.expr).toBe('');
  });
});

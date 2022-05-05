import { act, renderHook } from '@testing-library/react-hooks';

import { TraceSpan } from '@jaegertracing/jaeger-ui-components';

import { useSearch } from './useSearch';

describe('useSearch', () => {
  it('returns matching span IDs', async () => {
    const { result } = renderHook(() =>
      useSearch([
        {
          spanID: 'span1',
          operationName: 'operation1',
          process: {
            serviceName: 'service1',
            tags: [],
          },
          tags: [],
          logs: [],
        } as unknown as TraceSpan,

        {
          spanID: 'span2',
          operationName: 'operation2',
          process: {
            serviceName: 'service2',
            tags: [],
          },
          tags: [],
          logs: [],
        } as unknown as TraceSpan,
      ])
    );

    act(() => result.current.setSearch('service1'));
    expect(result.current.spanFindMatches?.size).toBe(1);
    expect(result.current.spanFindMatches?.has('span1')).toBe(true);
  });

  it('works without spans', async () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setSearch('service1'));
    expect(result.current.spanFindMatches).toBe(undefined);
  });
});

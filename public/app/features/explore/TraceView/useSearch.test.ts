import { act, renderHook } from '@testing-library/react';

import { TraceSpan } from './components';
import { defaultFilters, useSearch } from './useSearch';

describe('useSearch', () => {
  const spans = [
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
  ];

  it('returns matching span IDs', async () => {
    const { result } = renderHook(() => useSearch(spans));
    act(() => result.current.setSearch({ ...defaultFilters, serviceName: 'service1' }));
    expect(result.current.spanFilterMatches?.size).toBe(1);
    expect(result.current.spanFilterMatches?.has('span1')).toBe(true);
  });

  it('works without spans', async () => {
    const { result } = renderHook(() => useSearch());
    act(() => result.current.setSearch({ ...defaultFilters, serviceName: 'service1' }));
    expect(result.current.spanFilterMatches).toBe(undefined);
  });
});

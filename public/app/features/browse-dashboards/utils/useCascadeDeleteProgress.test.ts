import { renderHook } from 'test/test-utils';

import { useCascadeDeleteProgress } from './useCascadeDeleteProgress';

describe('useCascadeDeleteProgress', () => {
  it('returns undefined while remaining is unknown', () => {
    const { result } = renderHook(({ remaining }) => useCascadeDeleteProgress(remaining), {
      initialProps: { remaining: undefined as number | undefined },
    });

    expect(result.current).toBeUndefined();
  });

  it('remembers the first observed count as the total and reports 0% initially', () => {
    const { result } = renderHook(({ remaining }) => useCascadeDeleteProgress(remaining), {
      initialProps: { remaining: 4 },
    });

    expect(result.current).toBe(0);
  });

  it('reports progress as remaining drops below the initial total', () => {
    const { result, rerender } = renderHook(({ remaining }) => useCascadeDeleteProgress(remaining), {
      initialProps: { remaining: 4 },
    });

    rerender({ remaining: 2 });
    expect(result.current).toBe(50);

    rerender({ remaining: 0 });
    expect(result.current).toBe(100);
  });

  it('reports 100% immediately when the initial count is already 0', () => {
    const { result } = renderHook(({ remaining }) => useCascadeDeleteProgress(remaining), {
      initialProps: { remaining: 0 },
    });

    expect(result.current).toBe(100);
  });

  it('bumps the total up instead of going negative if remaining later exceeds it', () => {
    const { result, rerender } = renderHook(({ remaining }) => useCascadeDeleteProgress(remaining), {
      initialProps: { remaining: 4 },
    });

    rerender({ remaining: 2 });
    expect(result.current).toBe(50);

    // A resync discovers more direct children than first observed.
    rerender({ remaining: 8 });
    expect(result.current).toBe(0);
  });
});

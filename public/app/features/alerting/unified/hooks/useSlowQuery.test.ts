import { act, renderHook } from '@testing-library/react';

import { useSlowQuery } from './useSlowQuery';

describe('useSlowQuery()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns false before the threshold has elapsed', () => {
    const { result } = renderHook(() => useSlowQuery(true, { threshold: 10_000 }));

    act(() => {
      jest.advanceTimersByTime(9_999);
    });

    expect(result.current).toBe(false);
  });

  it('returns true once the threshold has elapsed while loading', () => {
    const { result } = renderHook(() => useSlowQuery(true, { threshold: 10_000 }));

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current).toBe(true);
  });

  it('resets to false when loading finishes', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useSlowQuery(isLoading, { threshold: 10_000 }), {
      initialProps: { isLoading: true },
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(true);

    rerender({ isLoading: false });
    expect(result.current).toBe(false);
  });
});

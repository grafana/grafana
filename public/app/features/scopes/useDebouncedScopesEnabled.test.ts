import { act, renderHook } from '@testing-library/react';

import { useDebouncedScopesEnabled } from './useDebouncedScopesEnabled';

describe('useDebouncedScopesEnabled', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('propagates true immediately', () => {
    const { result } = renderHook(() => useDebouncedScopesEnabled(true));
    expect(result.current).toBe(true);
  });

  it('propagates a sustained false after the debounce window', () => {
    const { result, rerender } = renderHook(({ enabled }) => useDebouncedScopesEnabled(enabled), {
      initialProps: { enabled: true },
    });
    expect(result.current).toBe(true);

    rerender({ enabled: false });
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);
  });

  it('absorbs a transient false->true flap within the debounce window', () => {
    const { result, rerender } = renderHook(({ enabled }) => useDebouncedScopesEnabled(enabled), {
      initialProps: { enabled: true },
    });
    expect(result.current).toBe(true);

    rerender({ enabled: false });
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current).toBe(true);

    rerender({ enabled: true });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current).toBe(true);
  });
});

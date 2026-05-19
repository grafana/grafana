import { act, renderHook } from '@testing-library/react';

import { useDelayedUnmount } from './useDelayedUnmount';

const EXIT_MS = 250;

describe('useDelayedUnmount', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('returns true immediately when visible starts true', () => {
    const { result } = renderHook(({ visible }) => useDelayedUnmount(visible, EXIT_MS), {
      initialProps: { visible: true },
    });

    expect(result.current).toBe(true);
  });

  it('returns false immediately when visible starts false (and does not schedule a timer)', () => {
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');

    const { result } = renderHook(({ visible }) => useDelayedUnmount(visible, EXIT_MS), {
      initialProps: { visible: false },
    });

    expect(result.current).toBe(false);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('keeps the element rendered for exitMs after visible flips to false, then unmounts', () => {
    const { result, rerender } = renderHook(({ visible }) => useDelayedUnmount(visible, EXIT_MS), {
      initialProps: { visible: true },
    });

    expect(result.current).toBe(true);

    rerender({ visible: false });
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(EXIT_MS - 1);
    });
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('cancels a pending unmount if visible flips back to true', () => {
    const { result, rerender } = renderHook(({ visible }) => useDelayedUnmount(visible, EXIT_MS), {
      initialProps: { visible: true },
    });

    rerender({ visible: false });
    act(() => {
      jest.advanceTimersByTime(EXIT_MS / 2);
    });
    expect(result.current).toBe(true);

    rerender({ visible: true });
    act(() => {
      jest.advanceTimersByTime(EXIT_MS);
    });
    expect(result.current).toBe(true);
  });

  it('clears the pending timer on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');

    const { rerender, unmount } = renderHook(({ visible }) => useDelayedUnmount(visible, EXIT_MS), {
      initialProps: { visible: true },
    });

    rerender({ visible: false });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

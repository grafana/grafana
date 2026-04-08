import { renderHook, act } from '@testing-library/react';

import { usePolling } from './usePolling';

describe('usePolling', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts in a loading state', () => {
    const fetchFn = jest.fn().mockResolvedValue(42);
    const { result } = renderHook(() => usePolling(fetchFn, 1000));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('populates data after the first fetch resolves', async () => {
    const fetchFn = jest.fn().mockResolvedValue(42);
    const { result } = renderHook(() => usePolling(fetchFn, 1000));
    await act(async () => {});
    expect(result.current.data).toBe(42);
    expect(result.current.loading).toBe(false);
  });

  it('sets error state when fetch throws', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('fetch failed'));
    const { result } = renderHook(() => usePolling(fetchFn, 1000));
    await act(async () => {});
    expect(result.current.error).toEqual(new Error('fetch failed'));
    expect(result.current.loading).toBe(false);
  });

  it('normalizes non-Error thrown values into an Error', async () => {
    const fetchFn = jest.fn().mockRejectedValue('plain string rejection');
    const { result } = renderHook(() => usePolling(fetchFn, 1000));
    await act(async () => {});
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('plain string rejection');
  });

  it('does not update state after unmount', async () => {
    let resolve!: (v: number) => void;
    const fetchFn = jest.fn().mockReturnValue(new Promise<number>((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => usePolling(fetchFn, 1000));
    unmount();
    await act(async () => {
      resolve(99);
    });
    expect(result.current.data).toBeNull();
  });

  it('calls fetchFn repeatedly at the specified interval', async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn().mockResolvedValue(1);
    renderHook(() => usePolling(fetchFn, 1000));

    await act(async () => {});
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('ignores stale responses when concurrent fetches resolve out of order', async () => {
    jest.useFakeTimers();

    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;

    const fetchFn = jest
      .fn()
      .mockReturnValueOnce(new Promise<number>((r) => (resolveFirst = r)))
      .mockReturnValueOnce(new Promise<number>((r) => (resolveSecond = r)));

    const { result } = renderHook(() => usePolling(fetchFn, 500));

    // Trigger second poll before first resolves
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    // Second resolves first with newer data
    await act(async () => {
      resolveSecond(99);
    });
    expect(result.current.data).toBe(99);

    // First resolves late — stale, should be discarded
    await act(async () => {
      resolveFirst(1);
    });
    expect(result.current.data).toBe(99);
  });
});

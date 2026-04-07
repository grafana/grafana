import { renderHook, act } from '@testing-library/react';

import { usePolling } from './usePolling';

describe('usePolling', () => {
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

  it('does not update state after unmount', async () => {
    let resolve!: (v: number) => void;
    const fetchFn = jest.fn().mockReturnValue(new Promise<number>((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => usePolling(fetchFn, 1000));
    unmount();
    await act(async () => { resolve(99); });
    expect(result.current.data).toBeNull();
  });
});

import { act, renderHook, waitFor } from 'test/test-utils';

import { useContinuationSearch } from './useContinuationSearch';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// STATE-1, STATE-3, SEARCH-2 (quality-and-performance.md case IDs, applied generically here
// since this hook backs every rule-search chain).
describe('useContinuationSearch', () => {
  it('loads the first page on mount', async () => {
    const fetchPage = jest.fn().mockResolvedValue({ items: ['a', 'b'], continueToken: undefined });

    const { result } = renderHook(() => useContinuationSearch(fetchPage, 'key-1'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it('shows a distinct error state on initial failure, with no rows', async () => {
    const fetchPage = jest.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useContinuationSearch(fetchPage, 'key-1'));

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.rows).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('appends rows and advances the continuation token on loadMore', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ items: ['a'], continueToken: 'tok-1' })
      .mockResolvedValueOnce({ items: ['b'], continueToken: undefined });

    const { result } = renderHook(() => useContinuationSearch(fetchPage, 'key-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toEqual(['a', 'b']));

    expect(fetchPage).toHaveBeenNthCalledWith(2, 'tok-1');
    expect(result.current.hasMore).toBe(false);
  });

  // STATE-3 / STATE-1: a rejected continuation token keeps the visible rows and offers retry.
  it('keeps rows visible and sets loadMoreError when loadMore fails, without touching the token', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ items: ['a'], continueToken: 'tok-1' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ items: ['b'], continueToken: undefined });

    const { result } = renderHook(() => useContinuationSearch(fetchPage, 'key-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadMoreError).toBeDefined());
    expect(result.current.rows).toEqual(['a']);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.rows).toEqual(['a', 'b']));
    // retry() reused the same token from the failed attempt.
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'tok-1');
  });

  // SEARCH-2: a late response for a superseded chain must never append to current rows.
  it('drops a stale first-page response that resolves after a reset', async () => {
    const first = deferred<{ items: string[]; continueToken?: string }>();
    const fetchPage = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ items: ['fresh'] });

    const { result, rerender } = renderHook(({ resetKey }) => useContinuationSearch(fetchPage, resetKey), {
      initialProps: { resetKey: 'key-1' },
    });

    rerender({ resetKey: 'key-2' });
    await waitFor(() => expect(result.current.rows).toEqual(['fresh']));

    // The first chain's fetch resolves after the reset - it must be ignored, not appended/replacing.
    act(() => first.resolve({ items: ['stale'] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.rows).toEqual(['fresh']);
  });

  it('restart() (refresh) replaces all rows with a fresh first page and resets requestCount tracking', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ items: ['a', 'b'], continueToken: undefined })
      .mockResolvedValueOnce({ items: ['c'], continueToken: undefined });

    const { result } = renderHook(() => useContinuationSearch(fetchPage, 'key-1'));
    await waitFor(() => expect(result.current.rows).toEqual(['a', 'b']));

    act(() => result.current.restart());
    await waitFor(() => expect(result.current.rows).toEqual(['c']));
    expect(result.current.requestCount).toBe(2);
  });
});

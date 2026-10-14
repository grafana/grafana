import { act, renderHook, waitFor } from 'test/test-utils';

import { useFolderPages } from './useFolderPages';

describe('useFolderPages', () => {
  it('loads the first page with no token, and exposes hasNext from the returned continuation', async () => {
    const fetchPage = jest.fn().mockResolvedValue({ items: ['f1', 'f2'], continueToken: 'tok-1' });

    const { result } = renderHook(() => useFolderPages(fetchPage, 'key-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual(['f1', 'f2']);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrevious).toBe(false);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it('next() advances using the previous page continuation token, and remembers it for previous()', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ items: ['page1'], continueToken: 'tok-1' })
      .mockResolvedValueOnce({ items: ['page2'], continueToken: undefined })
      .mockResolvedValueOnce({ items: ['page1'], continueToken: 'tok-1' });

    const { result } = renderHook(() => useFolderPages(fetchPage, 'key-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.next());
    await waitFor(() => expect(result.current.items).toEqual(['page2']));
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'tok-1');
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrevious).toBe(true);

    // previous() re-fetches page one using the remembered (undefined) start token, not a new request shape.
    act(() => result.current.previous());
    await waitFor(() => expect(result.current.items).toEqual(['page1']));
    expect(fetchPage).toHaveBeenNthCalledWith(3, undefined);
  });

  it('resets to page one and clears the token stack when resetKey changes', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({ items: ['a'], continueToken: 'tok-a' })
      .mockResolvedValueOnce({ items: ['b'], continueToken: undefined });

    const { result, rerender } = renderHook(({ resetKey }) => useFolderPages(fetchPage, resetKey), {
      initialProps: { resetKey: 'key-1' },
    });
    await waitFor(() => expect(result.current.items).toEqual(['a']));

    act(() => result.current.next());
    await waitFor(() => expect(result.current.items).toEqual(['b']));
    expect(result.current.hasPrevious).toBe(true);

    fetchPage.mockResolvedValueOnce({ items: ['c'], continueToken: undefined });
    rerender({ resetKey: 'key-2' });

    await waitFor(() => expect(result.current.items).toEqual(['c']));
    expect(result.current.hasPrevious).toBe(false);
    expect(fetchPage).toHaveBeenLastCalledWith(undefined);
  });

  it('previous() is a no-op on page one', async () => {
    const fetchPage = jest.fn().mockResolvedValue({ items: ['a'], continueToken: undefined });

    const { result } = renderHook(() => useFolderPages(fetchPage, 'key-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.previous());
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

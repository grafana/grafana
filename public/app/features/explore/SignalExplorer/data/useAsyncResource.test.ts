import { renderHook, waitFor } from '@testing-library/react';

import { useAsyncResource } from './useAsyncResource';

const EMPTY: string[] = [];

/**
 * The three metric hooks cover the shared behaviour through their own request keys. This suite covers
 * only what none of them reach: a rejection that is not an `Error`, and an unmount mid-flight.
 */
describe('useAsyncResource', () => {
  it('coerces a non-Error rejection into an Error, so callers can always read `message`', async () => {
    const fetch = jest.fn().mockRejectedValue('just a string');
    const { result } = renderHook(() => useAsyncResource('k1', fetch, EMPTY));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('just a string');
    expect(result.current.data).toEqual([]);
  });

  it('fetches nothing for a null key and reports the empty value as settled, not loading', () => {
    const fetch = jest.fn().mockResolvedValue(['unused']);
    const { result } = renderHook(() => useAsyncResource(null, fetch, EMPTY));

    expect(result.current).toEqual({ data: [], loading: false, error: undefined });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops the previous data when the key goes back to null', async () => {
    const fetch = jest.fn().mockResolvedValue(['loaded']);
    const { result, rerender } = renderHook(({ requestKey }) => useAsyncResource(requestKey, fetch, EMPTY), {
      initialProps: { requestKey: 'k1' as string | null },
    });
    await waitFor(() => expect(result.current.data).toEqual(['loaded']));

    rerender({ requestKey: null });

    expect(result.current).toEqual({ data: [], loading: false, error: undefined });
  });

  it('does not set state after unmount, so a late response cannot warn or leak', async () => {
    let resolve: (value: string[]) => void = () => {};
    const fetch = jest.fn().mockReturnValue(
      new Promise<string[]>((res) => {
        resolve = res;
      })
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useAsyncResource('k1', fetch, EMPTY));
    unmount();
    resolve(['late']);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

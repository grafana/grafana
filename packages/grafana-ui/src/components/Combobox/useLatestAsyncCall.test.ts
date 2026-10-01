import { renderHook } from '@testing-library/react';

import { StaleResultError, useLatestAsyncCall } from './useLatestAsyncCall';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useLatestAsyncCall', () => {
  it('resolves the latest call with its result', async () => {
    const fn = (value: string) => Promise.resolve(`result for ${value}`);
    const { result } = renderHook(() => useLatestAsyncCall(fn));

    await expect(result.current('a')).resolves.toBe('result for a');
  });

  it('rejects a superseded success with StaleResultError', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const responses = [first.promise, second.promise];
    const fn = (_value: string) => responses.shift() ?? Promise.reject(new Error('no response set up'));

    const { result } = renderHook(() => useLatestAsyncCall(fn));

    const firstCall = result.current('a');
    const secondCall = result.current('b');

    second.resolve('second result');
    await expect(secondCall).resolves.toBe('second result');

    // The first (superseded) request resolving late must not surface its result
    first.resolve('first result');
    await expect(firstCall).rejects.toBeInstanceOf(StaleResultError);
  });

  it('rejects a superseded failure with StaleResultError instead of the original error', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const responses = [first.promise, second.promise];
    const fn = (_value: string) => responses.shift() ?? Promise.reject(new Error('no response set up'));

    const { result } = renderHook(() => useLatestAsyncCall(fn));

    const firstCall = result.current('a');
    const secondCall = result.current('b');

    second.resolve('second result');
    await expect(secondCall).resolves.toBe('second result');

    // The first (superseded) request failing late is just as stale as it succeeding late
    first.reject(new Error('slow failure'));
    await expect(firstCall).rejects.toBeInstanceOf(StaleResultError);
  });

  it('rejects the latest call with its original error when it fails', async () => {
    const fn = (_value: string) => Promise.reject(new Error('real failure'));
    const { result } = renderHook(() => useLatestAsyncCall(fn));

    await expect(result.current('a')).rejects.toThrow('real failure');
  });
});

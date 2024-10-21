import { useCallback, useRef } from 'react';

type AsyncFn<T, V> = (value: T) => Promise<V>;

/**
 * Wraps an async function to ensure that only the latest call is resolved.
 * Used to prevent a faster call being overwritten by an earlier slower call.
 */
export function useLatestAsyncCall<T, V>(fn: AsyncFn<T, V>): AsyncFn<T, V> {
  const latestValue = useRef<T>();

  const wrappedFn = useCallback(
    (value: T) => {
      latestValue.current = value;

      return new Promise<V>((resolve, reject) => {
        fn(value).then((result) => {
          // Only resolve if the value is still the latest
          if (latestValue.current === value) {
            resolve(result);
          } else {
            reject(new StaleResultError());
          }
        });
      });
    },
    [fn]
  );

  return wrappedFn;
}

export class StaleResultError extends Error {
  constructor() {
    super('This result is stale and is discarded');
    this.name = 'StaleResultError';
    Object.setPrototypeOf(this, new.target.prototype); // Necessary for instanceof to work correctly
  }
}

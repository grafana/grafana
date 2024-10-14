import { useCallback, useRef } from 'react';

type AsyncFn<T, V> = (value: T) => Promise<V>;

export function useLatestAsyncCall<T, V>(fn: null | AsyncFn<T, V>): AsyncFn<T, V> {
  const latestValue = useRef<T>();

  const wrappedFn = useCallback(
    (value: T) => {
      if (!fn) {
        throw new Error('useLatestAsyncCall was called with a null function');
      }

      latestValue.current = value;

      return new Promise<V>((resolve, reject) => {
        fn(value).then((result) => {
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

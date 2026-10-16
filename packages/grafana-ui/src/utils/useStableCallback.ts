import { useCallback, useInsertionEffect, useRef } from 'react';

/** Keeps imperative subscriptions stable while invoking the latest committed callback. */
export function useStableCallback<Args extends unknown[], Return>(
  callback: (...args: Args) => Return
): (...args: Args) => Return {
  const latest = useRef(callback);

  // Update before child layout effects can invoke an imperative subscription.
  useInsertionEffect(() => {
    latest.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => latest.current(...args), []);
}

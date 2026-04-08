import { useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Polls an async function at a fixed interval, returning the latest result.
 *
 * Note: `loading` is `true` only during the initial fetch. Subsequent polls do
 * not reset `loading` to `true` — this is intentional to avoid spinner flicker
 * on every refresh cycle.
 *
 * @param fetchFn - Async function to call on each poll. Must be stable (e.g. wrapped
 *   in `useCallback`). An unstable reference continuously resets the interval,
 *   effectively preventing polling if the parent re-renders on every tick.
 * @param intervalMs - Polling interval in milliseconds. Changes take effect on the
 *   next render cycle.
 */
export function usePolling<T>(fetchFn: () => Promise<T>, intervalMs: number): PollingState<T> {
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const requestId = ++requestIdRef.current;
      try {
        const data = await fetchFn();
        if (!cancelled && requestId === requestIdRef.current) {
          setState({ data, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled && requestId === requestIdRef.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    };

    poll();
    const intervalId = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [fetchFn, intervalMs]);

  return state;
}

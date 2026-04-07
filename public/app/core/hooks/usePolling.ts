import { useEffect, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Polls an async function at a fixed interval, returning the latest result.
 *
 * @param fetchFn - Async function to call on each poll. Should be stable (e.g. wrapped
 *   in useCallback) to avoid triggering unnecessary effect re-runs.
 * @param intervalMs - Polling interval in milliseconds.
 */
export function usePolling<T>(fetchFn: () => Promise<T>, intervalMs: number): PollingState<T> {
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await fetchFn();
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: err as Error }));
        }
      }
    };

    poll();
    const intervalId = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [fetchFn]); // intervalMs intentionally omitted — changing interval has no effect at runtime

  return state;
}

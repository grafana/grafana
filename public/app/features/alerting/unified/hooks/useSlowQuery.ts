import { useEffect, useRef, useState } from 'react';

const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 5_000; // 5 seconds

interface UseSlowQueryOptions {
  /** Time in milliseconds before the query is considered slow. Defaults to 10 000 ms. */
  threshold?: number;
}

/**
 * Returns true once `isLoading` has been continuously true for longer than `threshold` ms.
 * Resets to false when `isLoading` becomes false.
 */
export function useSlowQuery(isLoading: boolean, options: UseSlowQueryOptions = {}): boolean {
  const { threshold = DEFAULT_SLOW_QUERY_THRESHOLD_MS } = options;
  const [isSlowQuery, setIsSlowQuery] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      timerRef.current = setTimeout(() => setIsSlowQuery(true), threshold);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsSlowQuery(false);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isLoading, threshold]);

  return isSlowQuery;
}

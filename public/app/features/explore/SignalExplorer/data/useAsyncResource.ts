import { useEffect, useState } from 'react';

/**
 * The loading, cancellation and staleness rules the three metric data hooks share, keyed on one
 * request string that the caller builds.
 *
 * That key must be made of primitives, not `dsRef`/`timeRange` object identity: callers construct
 * those objects fresh on every render, so keying on them would refetch on every render instead of
 * only when the request actually changes. Its datasource segment must be the resource client's own
 * `dsKey()` and its range segment the client's `rangeKey()`, never a re-derivation of either — the
 * client serves two refs or ranges it considers equal from the same cache entry, so a caller that
 * told them apart would refetch and get the same data back. A refresh that keeps the same relative
 * range string (e.g. `now-1h`/`now`) is therefore deliberately not a new request.
 *
 * An explicit invalidation lands the other way round: the datasource and range are unchanged, but
 * the cached answer for them is gone, so it has to count as a different request. That is why the
 * generation from `useMetricCacheGeneration` belongs in the key too.
 *
 * A `null` key means off — zero fetches, `empty` data, `loading: false`. It is what lets a collapsed
 * row, or a component whose host already owns the data, hold one of these hooks unconditionally
 * without firing a request.
 */
export function useAsyncResource<T>(
  requestKey: string | null,
  fetch: () => Promise<T>,
  empty: T
): { data: T; loading: boolean; error?: Error } {
  const [data, setData] = useState<T>(empty);
  const [loading, setLoading] = useState(requestKey !== null);
  const [error, setError] = useState<Error | undefined>(undefined);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  if (requestKey !== activeKey) {
    // Adjust state during render, not only in the effect below: passive effects run after the
    // browser paints, so raising `loading` and clearing stale `data` solely in the effect would let
    // one real frame paint the *previous* request's result (with `loading: false`) while the inputs
    // already point at the new request. Doing it here means the very render that changes the
    // request already reports the correct loading/empty state before anything is drawn.
    setActiveKey(requestKey);
    setData(empty);
    setError(undefined);
    setLoading(requestKey !== null);
  }

  useEffect(() => {
    if (requestKey === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetch()
      .then((value) => {
        if (!cancelled) {
          setData(value);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setData(empty);
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // `requestKey` is the entire dependency by design: it already encodes every input `fetch` closes
    // over, so adding `fetch` (rebuilt each render) would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return { data, loading, error };
}

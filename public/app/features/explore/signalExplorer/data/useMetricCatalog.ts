import { useEffect, useMemo, useState } from 'react';

import type { DataSourceRef, TimeRange } from '@grafana/data';

import type { MetricRow, MetricType } from '../types';

import { dsKey, fetchCatalog, rangeKey } from './metricResourceClient';

export function useMetricCatalog(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  opts?: { typeFilter?: MetricType | null; searchText?: string }
): { metrics: MetricRow[]; loading: boolean; error?: Error } {
  const [all, setAll] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Depend on primitive keys, not `dsRef`/`timeRange` object identity: callers construct these
  // objects fresh on every render, so depending on the objects directly would refetch on every
  // render instead of only when the datasource or range actually changes.
  //
  // The datasource half of the key is the client's own `dsKey()`, not a re-derivation of it: the
  // client serves two refs it considers equal from the same cache entry, so a hook that told them
  // apart would refetch and get the same data back.
  const requestDsKey = dsKey(dsRef);
  // A refresh that keeps the same relative range string (e.g. `now-1h`/`now`) intentionally does
  // not refetch here: the client already serves that unchanged key from its own cache, so a
  // second effect run would be a redundant no-op.
  const fromTo = rangeKey(timeRange);

  const requestKey = `${requestDsKey}|${fromTo}`;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  if (requestKey !== activeKey) {
    // Adjust state during render, not only in the effect below: passive effects run after the
    // browser paints, so raising `loading`/clearing stale `all` solely in the effect would let
    // one real frame paint the *previous* datasource's metrics (with `loading: false`) while
    // `dsRef`/`timeRange` already point at the new request. Doing it here means the very render
    // that changes the request already reports the correct loading/empty state before anything
    // is drawn. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
    setActiveKey(requestKey);
    setAll([]);
    setError(undefined);
    setLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetchCatalog(dsRef, timeRange)
      .then((rows) => {
        if (!cancelled) {
          setAll(rows);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setAll([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestDsKey, fromTo]);

  const metrics = useMemo(() => {
    const q = (opts?.searchText ?? '').toLowerCase();
    const type = opts?.typeFilter ?? null;
    return all.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!type || m.type === type));
  }, [all, opts?.searchText, opts?.typeFilter]);

  return { metrics, loading, error };
}

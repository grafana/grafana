import { useEffect, useState } from 'react';

import type { DataSourceRef, TimeRange } from '@grafana/data';

import { fetchLabelKeys } from './metricResourceClient';

export function useMetricDetail(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  metric: string,
  enabled: boolean
): { labelKeys: string[]; loading: boolean; error?: Error } {
  const [labelKeys, setLabelKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Depend on primitive keys, not `dsRef`/`timeRange` object identity: callers construct these
  // objects fresh on every render, so depending on the objects directly would refetch on every
  // render instead of only when the datasource, range, metric, or `enabled` actually change.
  //
  // `dsRef.uid` is optional: a type-only ref (e.g. `{ type: 'prometheus' }`, meaning "the
  // default datasource of this type") is valid and must be distinguishable from another
  // type-only ref. Fall back to `type` the same way `metricResourceClient`'s `dsKey()` does, so
  // this hook's refetch trigger stays consistent with what the client treats as a distinct
  // datasource.
  const dsKey = dsRef.uid ?? dsRef.type ?? '';
  // A refresh that keeps the same relative range string (e.g. `now-1h`/`now`) intentionally does
  // not refetch here: the client already serves that unchanged key from its own cache, so a
  // second effect run would be a redundant no-op.
  const fromTo = `${timeRange.raw?.from ?? ''}:${timeRange.raw?.to ?? ''}`;

  useEffect(() => {
    // `enabled` gates the fetch entirely: a collapsed/off-screen row must fire zero requests, so
    // this effect is a no-op until the caller flips `enabled` to true.
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetchLabelKeys(dsRef, timeRange, metric)
      .then((keys) => {
        if (!cancelled) {
          setLabelKeys(keys);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLabelKeys([]);
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
  }, [enabled, dsKey, fromTo, metric]);

  return { labelKeys, loading, error };
}

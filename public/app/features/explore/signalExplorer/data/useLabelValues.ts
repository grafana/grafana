import { useEffect, useState } from 'react';

import type { DataSourceRef, TimeRange } from '@grafana/data';

import { fetchLabelValues } from './metricResourceClient';

export function useLabelValues(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  metric: string,
  labelKey: string,
  enabled: boolean
): { values: string[]; loading: boolean; error?: Error } {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Depend on primitive keys, not `dsRef`/`timeRange` object identity: callers construct these
  // objects fresh on every render, so depending on the objects directly would refetch on every
  // render instead of only when the datasource, range, metric, labelKey, or `enabled` actually
  // change.
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

  // `null` while disabled: there's no request to key against, so nothing to adjust for.
  const requestKey = enabled ? `${dsKey}|${fromTo}|${metric}|${labelKey}` : null;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  if (requestKey !== activeKey) {
    // Adjust state during render, not only in the effect below: passive effects run after the
    // browser paints, so raising `loading`/clearing stale `values` solely in the effect would
    // let one real frame paint with the *previous* request's data (or an empty result) while
    // `enabled`/`metric`/`labelKey` already point at the new request. Doing it here means the
    // very render that changes the request already reports the correct loading/empty state
    // before anything is drawn. See
    // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
    setActiveKey(requestKey);
    setValues([]);
    setError(undefined);
    setLoading(requestKey !== null);
  }

  useEffect(() => {
    // `enabled` gates the fetch entirely: a collapsed label row must fire zero requests, so this
    // effect is a no-op until the caller flips `enabled` to true.
    if (!enabled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetchLabelValues(dsRef, timeRange, metric, labelKey)
      .then((fetched) => {
        if (!cancelled) {
          setValues(fetched);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setValues([]);
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
  }, [enabled, dsKey, fromTo, metric, labelKey]);

  return { values, loading, error };
}

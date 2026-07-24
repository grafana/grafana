import { useEffect, useMemo, useState } from 'react';

import type { DataSourceRef, TimeRange } from '@grafana/data';

import type { MetricRow, MetricType } from '../types';

import { fetchCatalog } from './metricResourceClient';

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
  const uid = dsRef.uid;
  const fromTo = `${timeRange.raw?.from ?? ''}:${timeRange.raw?.to ?? ''}`;

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
  }, [uid, fromTo]);

  const metrics = useMemo(() => {
    const q = (opts?.searchText ?? '').toLowerCase();
    const type = opts?.typeFilter ?? null;
    return all.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!type || m.type === type));
  }, [all, opts?.searchText, opts?.typeFilter]);

  return { metrics, loading, error };
}

import { useMemo } from 'react';

import type { DataSourceRef, TimeRange } from '@grafana/data';

import type { MetricInfo, MetricType } from '../types';

import { dsKey, fetchCatalog, rangeKey } from './metricResourceClient';
import { useAsyncResource } from './useAsyncResource';
import { useMetricCacheGeneration } from './useMetricCacheGeneration';

const NO_METRICS: MetricInfo[] = [];

/** What a catalog reader gets. */
export interface MetricCatalog {
  metrics: MetricInfo[];
  loading: boolean;
  error?: Error;
}

export function useMetricCatalog(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  opts?: { typeFilter?: MetricType | null; searchText?: string },
  /** Off means zero requests, an empty list and `loading: false` — the same gate the label hooks have. */
  enabled = true
): MetricCatalog {
  const generation = useMetricCacheGeneration(dsRef);
  const requestKey = enabled ? `${dsKey(dsRef)}|${rangeKey(timeRange)}|${generation}` : null;

  const { data: all, loading, error } = useAsyncResource(requestKey, () => fetchCatalog(dsRef, timeRange), NO_METRICS);

  const metrics = useMemo(() => {
    const q = (opts?.searchText ?? '').trim().toLowerCase();
    const type = opts?.typeFilter ?? null;
    return all.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!type || m.type === type));
  }, [all, opts?.searchText, opts?.typeFilter]);

  return { metrics, loading, error };
}

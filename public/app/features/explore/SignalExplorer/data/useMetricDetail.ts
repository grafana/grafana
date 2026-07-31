import type { DataSourceRef, TimeRange } from '@grafana/data';

import { dsKey, fetchLabelKeys, rangeKey } from './metricResourceClient';
import { useAsyncResource } from './useAsyncResource';
import { useMetricCacheGeneration } from './useMetricCacheGeneration';

const NO_LABEL_KEYS: string[] = [];

export function useMetricDetail(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  metric: string
): { labelKeys: string[]; loading: boolean; error?: Error } {
  const generation = useMetricCacheGeneration(dsRef);
  const requestKey = `${dsKey(dsRef)}|${rangeKey(timeRange)}|${metric}|${generation}`;

  const { data, loading, error } = useAsyncResource(
    requestKey,
    () => fetchLabelKeys(dsRef, timeRange, metric),
    NO_LABEL_KEYS
  );

  return { labelKeys: data, loading, error };
}

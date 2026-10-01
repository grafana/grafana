import type { DataSourceRef, TimeRange } from '@grafana/data';

import { dsKey, fetchLabelValues, rangeKey } from './metricResourceClient';
import { useAsyncResource } from './useAsyncResource';
import { useMetricCacheGeneration } from './useMetricCacheGeneration';

const NO_VALUES: string[] = [];

export function useLabelValues(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  metric: string,
  labelKey: string
): { values: string[]; loading: boolean; error?: Error } {
  const generation = useMetricCacheGeneration(dsRef);
  const requestKey = `${dsKey(dsRef)}|${rangeKey(timeRange)}|${metric}|${labelKey}|${generation}`;

  const { data, loading, error } = useAsyncResource(
    requestKey,
    () => fetchLabelValues(dsRef, timeRange, metric, labelKey),
    NO_VALUES
  );

  return { values: data, loading, error };
}

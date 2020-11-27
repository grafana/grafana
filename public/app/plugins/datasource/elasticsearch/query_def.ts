import { BucketAggregation } from './components/BucketAggregationsEditor/aggregations';
import {
  ExtendedStat,
  MetricAggregation,
  MovingAverageModelOption,
  MetricAggregationType,
} from './components/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig, pipelineOptions } from './components/MetricAggregationsEditor/utils';

export const extendedStats: ExtendedStat[] = [
  { label: 'Avg', value: 'avg' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'Sum', value: 'sum' },
  { label: 'Count', value: 'count' },
  { label: 'Std Dev', value: 'std_deviation' },
  { label: 'Std Dev Upper', value: 'std_deviation_bounds_upper' },
  { label: 'Std Dev Lower', value: 'std_deviation_bounds_lower' },
];

export const movingAvgModelOptions: MovingAverageModelOption[] = [
  { label: 'Simple', value: 'simple' },
  { label: 'Linear', value: 'linear' },
  { label: 'Exponentially Weighted', value: 'ewma' },
  { label: 'Holt Linear', value: 'holt' },
  { label: 'Holt Winters', value: 'holt_winters' },
];

export function defaultMetricAgg(id = '1'): MetricAggregation {
  return { type: 'count', id };
}

export function defaultBucketAgg(id = '1'): BucketAggregation {
  return { type: 'date_histogram', id, settings: { interval: 'auto' } };
}

export const findMetricById = (metrics: MetricAggregation[], id: MetricAggregation['id']) =>
  metrics.find(metric => metric.id === id);

export function hasMetricOfType(target: any, type: string): boolean {
  return target && target.metrics && target.metrics.some((m: any) => m.type === type);
}

/**
 * @deprecated TODO: Remove this, we should rely on type guards if possible
 */
export function isPipelineAgg(metricType: MetricAggregationType) {
  return metricType in pipelineOptions;
}

/**
 * @deprecated TODO: Remove this, we should rely on type guards if possible
 */
export function isPipelineAggWithMultipleBucketPaths(metricType: MetricAggregationType) {
  return !!metricAggregationConfig[metricType].supportsMultipleBucketPaths;
}

import { BucketAggregation } from './components/BucketAggregationsEditor/aggregations';
import {
  ExtendedStat,
  MetricAggregation,
  MovingAverageModelOption,
  MovingAverageSettingDefinition,
  MovingAverageModel,
  MetricAggregationType,
} from './components/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig, pipelineOptions } from './components/MetricAggregationsEditor/utils';

export const extendedStats: ExtendedStat[] = [
  { label: 'Avg', value: 'avg', default: false },
  { label: 'Min', value: 'min', default: false },
  { label: 'Max', value: 'max', default: false },
  { label: 'Sum', value: 'sum', default: false },
  { label: 'Count', value: 'count', default: false },
  { label: 'Std Dev', value: 'std_deviation', default: false },
  { label: 'Std Dev Upper', value: 'std_deviation_bounds_upper', default: true },
  { label: 'Std Dev Lower', value: 'std_deviation_bounds_lower', default: true },
];

export const movingAvgModelOptions: MovingAverageModelOption[] = [
  { label: 'Simple', value: 'simple' },
  { label: 'Linear', value: 'linear' },
  { label: 'Exponentially Weighted', value: 'ewma' },
  { label: 'Holt Linear', value: 'holt' },
  { label: 'Holt Winters', value: 'holt_winters' },
];

const alphaSetting: MovingAverageSettingDefinition = { label: 'Alpha', value: 'alpha' };
const betaSetting: MovingAverageSettingDefinition = { label: 'Beta', value: 'beta' };
const minimizeSetting: MovingAverageSettingDefinition = { label: 'Minimize', value: 'minimize', type: 'boolean' };

export const movingAvgModelSettings: Record<MovingAverageModel, MovingAverageSettingDefinition[]> = {
  simple: [],
  linear: [],
  ewma: [alphaSetting, minimizeSetting],
  holt: [alphaSetting, betaSetting, minimizeSetting],
  holt_winters: [
    alphaSetting,
    betaSetting,
    { label: 'Gamma', value: 'gamma' },
    { label: 'Period', value: 'period' },
    { label: 'Pad', value: 'pad', type: 'boolean' },
    minimizeSetting,
  ],
};

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
  if (metricType in pipelineOptions) {
    return true;
  }

  return false;
}

/**
 * @deprecated TODO: Remove this, we should rely on type guards if possible
 */
export function isPipelineAggWithMultipleBucketPaths(metricType: MetricAggregationType) {
  return !!metricAggregationConfig[metricType].supportsMultipleBucketPaths;
  // return metricAggTypes.find(t => t.value === metricType && t.supportsMultipleBucketPaths) !== undefined;
}

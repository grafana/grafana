import _ from 'lodash';
import { BucketAggregation } from './components/BucketAggregationsEditor/state/types';
import { orderByOptions } from './components/BucketAggregationsEditor/utils';
import {
  ExtendedStat,
  isPipelineAggregation,
  MetricAggregation,
  MovingAverageModelOption,
  MovingAverageSettingDefinition,
  MovingAverageModel,
  MetricAggregationType,
} from './components/MetricAggregationsEditor/state/types';
import { metricAggregationConfig, pipelineOptions } from './components/MetricAggregationsEditor/utils';
import { describeMetric } from './utils';

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

export function getPipelineOptions(metric: MetricAggregation) {
  if (!isPipelineAggregation(metric)) {
    return [];
  }

  return pipelineOptions[metric.type];
}

export function getMovingAvgSettings(model: MovingAverageModel, filtered: boolean) {
  const filteredResult: any[] = [];
  if (filtered) {
    _.each(movingAvgModelSettings[model], setting => {
      if (setting.type !== 'boolean') {
        filteredResult.push(setting);
      }
    });
    return filteredResult;
  }
  return movingAvgModelSettings[model];
}

export function getOrderByOptions(target: any) {
  const metricRefs: any[] = [];
  _.each(target.metrics, metric => {
    if (metric.type !== 'count' && !isPipelineAgg(metric.type)) {
      metricRefs.push({ text: describeMetric(metric), value: metric.id });
    }
  });

  return orderByOptions.concat(metricRefs);
}

export function defaultMetricAgg(id = '1'): MetricAggregation {
  return { type: 'count', id, hide: false };
}

export function defaultBucketAgg(id = '1'): BucketAggregation {
  return { type: 'date_histogram', id, settings: { interval: 'auto' } };
}

export const findMetricById = (metrics: any[], id: string) => {
  return _.find(metrics, { id: id });
};

export function hasMetricOfType(target: any, type: string): boolean {
  return target && target.metrics && target.metrics.some((m: any) => m.type === type);
}

/**
 * @deprecated TODO: Remove
 */
export function isPipelineAgg(metricType: MetricAggregationType) {
  if (metricType in pipelineOptions) {
    return true;
  }

  return false;
}

/**
 * @deprecated TODO: Remove
 */
export function isPipelineAggWithMultipleBucketPaths(metricType: MetricAggregationType) {
  return !!metricAggregationConfig[metricType].supportsMultipleBucketPaths;
  // return metricAggTypes.find(t => t.value === metricType && t.supportsMultipleBucketPaths) !== undefined;
}

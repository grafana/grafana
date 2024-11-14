import {
  PipelineMetricAggregationWithMultipleBucketPaths,
  MetricAggregationWithMeta,
  MovingAverage,
  MetricAggregationType,
  BaseMetricAggregation,
  MetricAggregationWithField,
  MetricAggregationWithMissingSupport,
  MetricAggregationWithInlineScript,
  PipelineMetricAggregation,
  MetricAggregationWithSettings,
} from '../../../types';

import { metricAggregationConfig } from './utils';

export const isEWMAMovingAverage = (metric: MovingAverage | MovingAverage<'ewma'>): metric is MovingAverage<'ewma'> =>
  metric.settings?.model === 'ewma';

export const isHoltMovingAverage = (metric: MovingAverage | MovingAverage<'holt'>): metric is MovingAverage<'holt'> =>
  metric.settings?.model === 'holt';

export const isHoltWintersMovingAverage = (
  metric: MovingAverage | MovingAverage<'holt_winters'>
): metric is MovingAverage<'holt_winters'> => metric.settings?.model === 'holt_winters';

export const isMovingAverageWithModelSettings = (
  metric: MovingAverage
): metric is MovingAverage<'ewma'> | MovingAverage<'holt'> | MovingAverage<'holt_winters'> =>
  ['holt', 'ewma', 'holt_winters'].includes(metric.settings?.model || '');

// Guards
// Given the structure of the aggregations (ie. `settings` field being always optional) we cannot
// determine types based solely on objects' properties, therefore we use `metricAggregationConfig` as the
// source of truth.

/**
 * Checks if `metric` requires a field (either referring to a document or another aggregation)
 * @param metric
 */
export const isMetricAggregationWithField = (
  metric: BaseMetricAggregation | MetricAggregationWithField
): metric is MetricAggregationWithField => metricAggregationConfig[metric.type].requiresField;

export const isPipelineAggregation = (
  metric: BaseMetricAggregation | PipelineMetricAggregation
): metric is PipelineMetricAggregation => metricAggregationConfig[metric.type].isPipelineAgg;

export const isPipelineAggregationWithMultipleBucketPaths = (
  metric: BaseMetricAggregation | PipelineMetricAggregationWithMultipleBucketPaths
): metric is PipelineMetricAggregationWithMultipleBucketPaths =>
  metricAggregationConfig[metric.type].supportsMultipleBucketPaths;

export const isMetricAggregationWithMissingSupport = (
  metric: BaseMetricAggregation | MetricAggregationWithMissingSupport
): metric is MetricAggregationWithMissingSupport => metricAggregationConfig[metric.type].supportsMissing;

export const isMetricAggregationWithSettings = (
  metric: BaseMetricAggregation | MetricAggregationWithSettings
): metric is MetricAggregationWithSettings => metricAggregationConfig[metric.type].hasSettings;

export const isMetricAggregationWithMeta = (
  metric: BaseMetricAggregation | MetricAggregationWithMeta
): metric is MetricAggregationWithMeta => metricAggregationConfig[metric.type].hasMeta;

export const isMetricAggregationWithInlineScript = (
  metric: BaseMetricAggregation | MetricAggregationWithInlineScript
): metric is MetricAggregationWithInlineScript => metricAggregationConfig[metric.type].supportsInlineScript;

export const METRIC_AGGREGATION_TYPES: MetricAggregationType[] = [
  'count',
  'avg',
  'sum',
  'min',
  'max',
  'extended_stats',
  'percentiles',
  'cardinality',
  'raw_document',
  'raw_data',
  'logs',
  'moving_avg',
  'moving_fn',
  'derivative',
  'serial_diff',
  'cumulative_sum',
  'bucket_script',
  'rate',
  'top_metrics',
];

export const isMetricAggregationType = (s: MetricAggregationType | string): s is MetricAggregationType =>
  METRIC_AGGREGATION_TYPES.includes(s as MetricAggregationType);

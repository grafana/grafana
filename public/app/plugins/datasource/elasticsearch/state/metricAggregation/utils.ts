import { MetricsConfiguration } from '../../types';

export const metricAggregationConfig: MetricsConfiguration = {
  count: {
    label: 'Count',
    requiresField: false,
  },
  avg: {
    label: 'Average',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  sum: {
    label: 'Sum',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  max: {
    label: 'Max',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  min: {
    label: 'Min',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
  },
  extended_stats: {
    label: 'Extended Stats',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
  },
  percentiles: {
    label: 'Percentiles',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
  },
  cardinality: {
    label: 'Unique Count',
    requiresField: true,
    supportsMissing: true,
  },
  moving_avg: {
    label: 'Moving Average',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
  },
  moving_fn: {
    label: 'Moving Function',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 70,
  },
  derivative: {
    label: 'Derivative',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
  },
  cumulative_sum: {
    label: 'Cumulative Sum',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
  },
  bucket_script: {
    label: 'Bucket Script',
    requiresField: false,
    isPipelineAgg: true,
    supportsMultipleBucketPaths: true,
    minVersion: 2,
  },
  raw_document: {
    label: 'Raw Document (legacy)',
    requiresField: false,
    isSingleMetric: true,
  },
  raw_data: {
    label: 'Raw Data',
    requiresField: false,
    isSingleMetric: true,
  },
  logs: {
    label: 'Logs',
    requiresField: false,
  },
};

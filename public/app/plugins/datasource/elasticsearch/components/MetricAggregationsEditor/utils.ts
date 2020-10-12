import { MetricsConfiguration } from '../../types';
import { isMetricAggregationWithField, MetricAggregation, PipelineMetricAggregationType } from './state/types';

// We can probably split Pipeline Aggregations from here.
export const metricAggregationConfig: MetricsConfiguration = {
  count: {
    label: 'Count',
    requiresField: false,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  avg: {
    label: 'Average',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  sum: {
    label: 'Sum',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  max: {
    label: 'Max',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  min: {
    label: 'Min',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  extended_stats: {
    label: 'Extended Stats',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  percentiles: {
    label: 'Percentiles',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  cardinality: {
    label: 'Unique Count',
    requiresField: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  moving_avg: {
    label: 'Moving Average',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
    supportsMultipleBucketPaths: false,
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
    supportsMultipleBucketPaths: false,
  },
  cumulative_sum: {
    label: 'Cumulative Sum',
    requiresField: false,
    isPipelineAgg: true,
    minVersion: 2,
    supportsMultipleBucketPaths: false,
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
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  raw_data: {
    label: 'Raw Data',
    requiresField: false,
    isSingleMetric: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
  logs: {
    label: 'Logs',
    requiresField: false,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
  },
};

interface PipelineOption {
  label: string;
  default?: string | number | boolean;
}

type PipelineOptions = {
  [K in PipelineMetricAggregationType]: PipelineOption[];
};

export const pipelineOptions: PipelineOptions = {
  moving_avg: [
    { label: 'window', default: 5 },
    { label: 'model', default: 'simple' },
    { label: 'predict' },
    { label: 'minimize', default: false },
  ],
  derivative: [{ label: 'unit' }],
  cumulative_sum: [{ label: 'format' }],
  bucket_script: [],
};

/**
 * Given a metric `MetricA` and an array of metrics, returns all ancestors of `MetricA`.
 * `MetricB` is considered an ancestor of `MetricA` if `MetricA` references `MetricB` in it's `field` attribute
 * (`MetricA.field === MetricB.id`).
 * @param metric
 * @param metrics
 */
export const getAncestors = (metric: MetricAggregation, metrics: MetricAggregation[]): MetricAggregation[] => {
  if (!isMetricAggregationWithField(metric)) {
    return [];
  }

  const parentIndex = metrics.findIndex(otherMetric => metric.field === otherMetric.id);

  if (parentIndex === -1) {
    return [];
  }

  return [metrics[parentIndex], ...getAncestors(metrics[parentIndex], metrics)];
};

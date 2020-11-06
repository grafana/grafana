import { MetricsConfiguration } from '../../types';
import {
  isMetricAggregationWithField,
  isPipelineAggregationWithMultipleBucketPaths,
  MetricAggregation,
  PipelineMetricAggregationType,
} from './aggregations';

export const metricAggregationConfig: MetricsConfiguration = {
  count: {
    label: 'Count',
    requiresField: false,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: false,
    hasMeta: false,
    supportsInlineScript: false,
  },
  avg: {
    label: 'Average',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
  },
  sum: {
    label: 'Sum',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
  },
  max: {
    label: 'Max',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
  },
  min: {
    label: 'Min',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
  },
  extended_stats: {
    label: 'Extended Stats',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: true,
  },
  percentiles: {
    label: 'Percentiles',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
  },
  cardinality: {
    label: 'Unique Count',
    requiresField: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
  },
  moving_avg: {
    label: 'Moving Average',
    requiresField: true,
    isPipelineAgg: true,
    minVersion: 2,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
  },
  moving_fn: {
    // TODO: Check this
    label: 'Moving Function',
    requiresField: true,
    isPipelineAgg: true,
    supportsMultipleBucketPaths: false,
    supportsInlineScript: false,
    supportsMissing: false,
    hasMeta: false,
    hasSettings: true,
    minVersion: 70,
  },
  derivative: {
    label: 'Derivative',
    requiresField: true,
    isPipelineAgg: true,
    minVersion: 2,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
  },
  cumulative_sum: {
    label: 'Cumulative Sum',
    requiresField: true,
    isPipelineAgg: true,
    minVersion: 2,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
  },
  bucket_script: {
    label: 'Bucket Script',
    requiresField: false,
    isPipelineAgg: true,
    supportsMissing: false,
    supportsMultipleBucketPaths: true,
    minVersion: 2,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
  },
  raw_document: {
    label: 'Raw Document (legacy)',
    requiresField: false,
    isSingleMetric: true,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
  },
  raw_data: {
    label: 'Raw Data',
    requiresField: false,
    isSingleMetric: true,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: false,
    supportsInlineScript: false,
    hasMeta: false,
  },
  logs: {
    label: 'Logs',
    requiresField: false,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
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
  moving_fn: [{ label: 'window', default: 5 }, { label: 'script' }],
  derivative: [{ label: 'unit' }],
  cumulative_sum: [{ label: 'format' }],
  bucket_script: [],
};

/**
 * Given a metric `MetricA` and an array of metrics, returns all children of `MetricA`.
 * `MetricB` is considered a child of `MetricA` if `MetricA` is referenced by `MetricB` in it's `field` attribute
 * (`MetricA.id === MetricB.field`) or in it's pipeline aggregation variables (for bucket_scripts).
 * @param metric
 * @param metrics
 */
export const getChildren = (metric: MetricAggregation, metrics: MetricAggregation[]): MetricAggregation[] => {
  const children = metrics.filter(m => {
    // TODO: Check this.
    if (isPipelineAggregationWithMultipleBucketPaths(m)) {
      return m.pipelineVariables?.some(pv => pv.pipelineAgg === metric.id);
    }

    return isMetricAggregationWithField(m) && metric.id === m.field;
  });

  return [...children, ...children.flatMap(child => getChildren(child, metrics))];
};

/**
 * Checks if a string is a valid number
 * @param stringNumber
 */
export const isValidNumber = (stringNumber: string) => {
  return !isNaN(+(stringNumber ?? 0));
};

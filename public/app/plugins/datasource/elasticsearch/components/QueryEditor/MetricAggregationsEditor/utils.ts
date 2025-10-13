import { MetricsConfiguration, MetricAggregation, PipelineMetricAggregationType } from '../../../types';

import {
  defaultPipelineVariable,
  generatePipelineVariableName,
} from './SettingsEditor/BucketScriptSettingsEditor/utils';
import { isMetricAggregationWithField, isPipelineAggregationWithMultipleBucketPaths } from './aggregations';

export const metricAggregationConfig: MetricsConfiguration = {
  count: {
    label: 'Count',
    impliedQueryType: 'metrics',
    requiresField: false,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: false,
    hasMeta: false,
    supportsInlineScript: false,
    defaults: {},
  },
  avg: {
    label: 'Average',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
    defaults: {},
  },
  sum: {
    label: 'Sum',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
    defaults: {},
  },
  max: {
    label: 'Max',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
    defaults: {},
  },
  min: {
    label: 'Min',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsInlineScript: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
    defaults: {},
  },
  extended_stats: {
    label: 'Extended Stats',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: true,
    defaults: {
      meta: {
        std_deviation_bounds_lower: true,
        std_deviation_bounds_upper: true,
      },
    },
  },
  percentiles: {
    label: 'Percentiles',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsMissing: true,
    supportsInlineScript: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    hasMeta: false,
    defaults: {
      settings: {
        percents: ['25', '50', '75', '95', '99'],
      },
    },
  },
  cardinality: {
    label: 'Unique Count',
    impliedQueryType: 'metrics',
    requiresField: true,
    supportsMissing: true,
    isPipelineAgg: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {},
  },
  moving_avg: {
    // deprecated in 6.4.0, removed in 8.0.0,
    // recommended replacement is moving_fn
    label: 'Moving Average',
    impliedQueryType: 'metrics',
    requiresField: true,
    isPipelineAgg: true,
    versionRange: '<8.0.0',
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      settings: {
        model: 'simple',
        window: '5',
      },
    },
  },
  moving_fn: {
    // TODO: Check this
    label: 'Moving Function',
    impliedQueryType: 'metrics',
    requiresField: true,
    isPipelineAgg: true,
    supportsMultipleBucketPaths: false,
    supportsInlineScript: false,
    supportsMissing: false,
    hasMeta: false,
    hasSettings: true,
    defaults: {},
  },
  derivative: {
    label: 'Derivative',
    impliedQueryType: 'metrics',
    requiresField: true,
    isPipelineAgg: true,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {},
  },
  serial_diff: {
    label: 'Serial Difference',
    impliedQueryType: 'metrics',
    requiresField: true,
    isPipelineAgg: true,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      settings: {
        lag: '1',
      },
    },
  },
  cumulative_sum: {
    label: 'Cumulative Sum',
    impliedQueryType: 'metrics',
    requiresField: true,
    isPipelineAgg: true,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {},
  },
  bucket_script: {
    label: 'Bucket Script',
    impliedQueryType: 'metrics',
    requiresField: false,
    isPipelineAgg: true,
    supportsMissing: false,
    supportsMultipleBucketPaths: true,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      pipelineVariables: [defaultPipelineVariable(generatePipelineVariableName([]))],
    },
  },
  raw_document: {
    label: 'Raw Document (deprecated)',
    requiresField: false,
    impliedQueryType: 'raw_document',
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      settings: {
        size: '500',
      },
    },
  },
  raw_data: {
    label: 'Raw Data',
    requiresField: false,
    impliedQueryType: 'raw_data',
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      settings: {
        size: '500',
      },
    },
  },
  logs: {
    label: 'Logs',
    requiresField: false,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    impliedQueryType: 'logs',
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      settings: {
        limit: '500',
      },
    },
  },
  top_metrics: {
    label: 'Top Metrics',
    impliedQueryType: 'metrics',
    requiresField: false,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: false,
    hasMeta: false,
    defaults: {
      settings: {
        order: 'desc',
      },
    },
  },
  rate: {
    label: 'Rate',
    impliedQueryType: 'metrics',
    requiresField: true,
    isPipelineAgg: false,
    supportsMissing: false,
    supportsMultipleBucketPaths: false,
    hasSettings: true,
    supportsInlineScript: true,
    hasMeta: false,
    defaults: {},
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
  serial_diff: [{ label: 'lag' }],
  cumulative_sum: [{ label: 'format' }],
  bucket_script: [],
};

/**
 * Given a metric `MetricA` and an array of metrics, returns all children of `MetricA`.
 * `MetricB` is considered a child of `MetricA` if `MetricA` is referenced by `MetricB` in its `field` attribute
 * (`MetricA.id === MetricB.field`) or in its pipeline aggregation variables (for bucket_scripts).
 * @param metric
 * @param metrics
 */
export const getChildren = (metric: MetricAggregation, metrics: MetricAggregation[]): MetricAggregation[] => {
  const children = metrics.filter((m) => {
    // TODO: Check this.
    if (isPipelineAggregationWithMultipleBucketPaths(m)) {
      return m.pipelineVariables?.some((pv) => pv.pipelineAgg === metric.id);
    }

    return isMetricAggregationWithField(m) && metric.id === m.field;
  });

  return [...children, ...children.flatMap((child) => getChildren(child, metrics))];
};

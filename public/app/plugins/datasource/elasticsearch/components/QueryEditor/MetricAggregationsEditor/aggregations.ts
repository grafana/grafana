import { metricAggregationConfig } from './utils';

export type PipelineMetricAggregationType =
  | 'moving_avg'
  | 'moving_fn'
  | 'derivative'
  | 'serial_diff'
  | 'cumulative_sum'
  | 'bucket_script';

export type MetricAggregationType =
  | 'count'
  | 'avg'
  | 'sum'
  | 'min'
  | 'max'
  | 'extended_stats'
  | 'percentiles'
  | 'cardinality'
  | 'raw_document'
  | 'raw_data'
  | 'logs'
  | 'rate'
  | 'top_metrics'
  | PipelineMetricAggregationType;

interface BaseMetricAggregation {
  id: string;
  type: MetricAggregationType;
  hide?: boolean;
}

export interface PipelineVariable {
  name: string;
  pipelineAgg: string;
}

export interface MetricAggregationWithField extends BaseMetricAggregation {
  field?: string;
}

export interface MetricAggregationWithMissingSupport extends BaseMetricAggregation {
  settings?: {
    missing?: string;
  };
}

type InlineScript = string | { inline?: string };
export interface MetricAggregationWithInlineScript extends BaseMetricAggregation {
  settings?: {
    script?: InlineScript;
  };
}

export interface Count extends BaseMetricAggregation {
  type: 'count';
}

export interface Average
  extends MetricAggregationWithField,
    MetricAggregationWithMissingSupport,
    MetricAggregationWithInlineScript {
  type: 'avg';
  settings?: {
    script?: InlineScript;
    missing?: string;
  };
}

export interface Sum extends MetricAggregationWithField, MetricAggregationWithInlineScript {
  type: 'sum';
  settings?: {
    script?: InlineScript;
    missing?: string;
  };
}

export interface Max extends MetricAggregationWithField, MetricAggregationWithInlineScript {
  type: 'max';
  settings?: {
    script?: InlineScript;
    missing?: string;
  };
}

export interface Min extends MetricAggregationWithField, MetricAggregationWithInlineScript {
  type: 'min';
  settings?: {
    script?: InlineScript;
    missing?: string;
  };
}

export type ExtendedStatMetaType =
  | 'avg'
  | 'min'
  | 'max'
  | 'sum'
  | 'count'
  | 'std_deviation'
  | 'std_deviation_bounds_upper'
  | 'std_deviation_bounds_lower';
export interface ExtendedStat {
  label: string;
  value: ExtendedStatMetaType;
}

export interface ExtendedStats extends MetricAggregationWithField, MetricAggregationWithInlineScript {
  type: 'extended_stats';
  settings?: {
    script?: InlineScript;
    missing?: string;
    sigma?: string;
  };
  meta?: {
    [P in ExtendedStatMetaType]?: boolean;
  };
}

export interface Percentiles extends MetricAggregationWithField, MetricAggregationWithInlineScript {
  type: 'percentiles';
  settings?: {
    percents?: string[];
    script?: InlineScript;
    missing?: string;
  };
}

export interface UniqueCount extends MetricAggregationWithField {
  type: 'cardinality';
  settings?: {
    precision_threshold?: string;
    missing?: string;
  };
}

export interface RawDocument extends BaseMetricAggregation {
  type: 'raw_document';
  settings?: {
    size?: string;
  };
}

export interface RawData extends BaseMetricAggregation {
  type: 'raw_data';
  settings?: {
    size?: string;
  };
}

export interface Logs extends BaseMetricAggregation {
  type: 'logs';
  settings?: {
    limit?: string;
  };
}

export interface Rate extends MetricAggregationWithField {
  type: 'rate';
  settings?: {
    unit?: string;
    mode?: string;
  };
}

export interface BasePipelineMetricAggregation extends MetricAggregationWithField {
  type: PipelineMetricAggregationType;
  pipelineAgg?: string;
}

export interface PipelineMetricAggregationWithMultipleBucketPaths extends BaseMetricAggregation {
  type: PipelineMetricAggregationType;
  pipelineVariables?: PipelineVariable[];
}

export type MovingAverageModel = 'simple' | 'linear' | 'ewma' | 'holt' | 'holt_winters';

export interface MovingAverageModelOption {
  label: string;
  value: MovingAverageModel;
}

export interface BaseMovingAverageModelSettings {
  model: MovingAverageModel;
  window: string;
  predict: string;
}

export interface MovingAverageSimpleModelSettings extends BaseMovingAverageModelSettings {
  model: 'simple';
}

export interface MovingAverageLinearModelSettings extends BaseMovingAverageModelSettings {
  model: 'linear';
}

export interface MovingAverageEWMAModelSettings extends BaseMovingAverageModelSettings {
  model: 'ewma';
  settings?: {
    alpha?: string;
  };
  minimize: boolean;
}

export interface MovingAverageHoltModelSettings extends BaseMovingAverageModelSettings {
  model: 'holt';
  settings: {
    alpha?: string;
    beta?: string;
  };
  minimize: boolean;
}

export interface MovingAverageHoltWintersModelSettings extends BaseMovingAverageModelSettings {
  model: 'holt_winters';
  settings: {
    alpha?: string;
    beta?: string;
    gamma?: string;
    period?: string;
    pad?: boolean;
  };
  minimize: boolean;
}

export type MovingAverageModelSettings<T extends MovingAverageModel = MovingAverageModel> = Partial<
  Extract<
    | MovingAverageSimpleModelSettings
    | MovingAverageLinearModelSettings
    | MovingAverageEWMAModelSettings
    | MovingAverageHoltModelSettings
    | MovingAverageHoltWintersModelSettings,
    { model: T }
  >
>;

export interface MovingAverage<T extends MovingAverageModel = MovingAverageModel>
  extends BasePipelineMetricAggregation {
  type: 'moving_avg';
  settings?: MovingAverageModelSettings<T>;
}

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

export interface MovingFunction extends BasePipelineMetricAggregation {
  type: 'moving_fn';
  settings?: {
    window?: string;
    script?: InlineScript;
    shift?: string;
  };
}

export interface Derivative extends BasePipelineMetricAggregation {
  type: 'derivative';
  settings?: {
    unit?: string;
  };
}

export interface SerialDiff extends BasePipelineMetricAggregation {
  type: 'serial_diff';
  settings?: {
    lag?: string;
  };
}

export interface CumulativeSum extends BasePipelineMetricAggregation {
  type: 'cumulative_sum';
  settings?: {
    format?: string;
  };
}

export interface BucketScript extends PipelineMetricAggregationWithMultipleBucketPaths {
  type: 'bucket_script';
  settings?: {
    script?: InlineScript;
  };
}

export interface TopMetrics extends BaseMetricAggregation {
  type: 'top_metrics';
  settings?: {
    order?: string;
    orderBy?: string;
    metrics?: string[];
  };
}

type PipelineMetricAggregation = MovingAverage | Derivative | CumulativeSum | BucketScript;

export type MetricAggregationWithSettings =
  | BucketScript
  | CumulativeSum
  | Derivative
  | SerialDiff
  | RawData
  | RawDocument
  | UniqueCount
  | Percentiles
  | ExtendedStats
  | Min
  | Max
  | Sum
  | Average
  | MovingAverage
  | MovingFunction
  | Logs
  | Rate
  | TopMetrics;

export type MetricAggregationWithMeta = ExtendedStats;

export type MetricAggregation = Count | PipelineMetricAggregation | MetricAggregationWithSettings;

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

import { Action } from '../../../hooks/useReducerCallback';
import { metricAggregationConfig } from '../utils';

export const ADD_METRIC = '@metrics/add';
export const REMOVE_METRIC = '@metrics/remove';
export const CHANGE_METRIC_TYPE = '@metrics/change_type';
export const CHANGE_METRIC_FIELD = '@metrics/change_field';
export const TOGGLE_METRIC_VISIBILITY = '@metrics/toggle_visibility';

export type PipelineMetricAggregationType =
  | 'moving_avg'
  | 'moving_fn'
  | 'derivative'
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
  | PipelineMetricAggregationType;

interface PipelineVariable {
  name: string;
  pipelineAgg: string;
}

interface BaseMetricAggregation {
  id: string;
  type: MetricAggregationType;
  hide: boolean;
}

export interface MetricAggregationWithField extends BaseMetricAggregation {
  field: string;
}

export interface MetricAggregationWithSettings extends BaseMetricAggregation {
  settings: Record<string, unknown>;
}

interface Count extends BaseMetricAggregation {
  type: 'count';
}

interface Average extends MetricAggregationWithField, MetricAggregationWithSettings {
  type: 'avg';
  settings: {
    unit: string;
    missing: number;
  };
}

interface Sum extends MetricAggregationWithField {
  type: 'sum';
}
interface Max extends MetricAggregationWithField {
  type: 'max';
}

interface Min extends MetricAggregationWithField {
  type: 'min';
}

interface ExtendedStats extends MetricAggregationWithField, MetricAggregationWithSettings {
  type: 'extended_stats';
  settings: {
    unit: string;
    missing: number;
    // TODO: Add other settings here
  };
}

interface Percentiles extends MetricAggregationWithField, MetricAggregationWithSettings {
  type: 'percentiles';
  settings: {
    percentiles: string;
    unit: string;
    missing: number;
  };
}

interface UniqueCount extends MetricAggregationWithField, MetricAggregationWithSettings {
  type: 'cardinality';
  settings: {
    precision_threshold: string;
    unit: string;
    missing: number;
  };
}

interface RawDocument extends MetricAggregationWithSettings {
  type: 'raw_document';
  settings: {
    size: number;
  };
}

interface RawData extends MetricAggregationWithSettings {
  type: 'raw_data';
  settings: {
    size: number;
  };
}

interface Logs extends BaseMetricAggregation {
  type: 'logs';
}

export interface BasePipelineMetricAggregation extends MetricAggregationWithField {
  type: PipelineMetricAggregationType;
}

interface PipelineMetricAggregationWithMoultipleBucketPaths extends BasePipelineMetricAggregation {
  pipelineVariables: PipelineVariable[];
}

interface MovingAverage extends BasePipelineMetricAggregation, MetricAggregationWithSettings {
  type: 'moving_avg';
  settings: {
    script: string;
  };
}

interface Derivative extends BasePipelineMetricAggregation {
  type: 'derivative';
  settings: {
    unit: string;
  };
}

interface CumulativeSum extends BasePipelineMetricAggregation {
  type: 'cumulative_sum';
  settings: {
    format: string;
  };
}

interface BucketScript extends PipelineMetricAggregationWithMoultipleBucketPaths {
  type: 'bucket_script';
}

type PipelineMetricAggregation = MovingAverage | Derivative | CumulativeSum | BucketScript;

export type MetricAggregation =
  | Count
  | Average
  | Sum
  | Max
  | Min
  | ExtendedStats
  | Percentiles
  | UniqueCount
  | PipelineMetricAggregation
  | RawDocument
  | RawData
  | Logs;

/**
 * Checks if `metric` requires a field (either referring to a document or another aggregation)
 * @param metric
 */
export const isMetricAggregationWithField = (
  metric: BaseMetricAggregation | MetricAggregationWithField
): metric is MetricAggregationWithField =>
  metricAggregationConfig[metric.type].requiresField || metricAggregationConfig[metric.type].isPipelineAgg;

export const isPipelineAggregation = (
  metric: BaseMetricAggregation | PipelineMetricAggregation
): metric is PipelineMetricAggregation => metricAggregationConfig[metric.type].isPipelineAgg;

export const isPipelineAggregationWithMultipleBucketPaths = (
  metric: BaseMetricAggregation | PipelineMetricAggregationWithMoultipleBucketPaths
): metric is PipelineMetricAggregationWithMoultipleBucketPaths =>
  metricAggregationConfig[metric.type].supportsMultipleBucketPaths;

//
// Action Types
export interface AddMetricAction extends Action<typeof ADD_METRIC> {
  payload: {
    metricType: MetricAggregation['type'];
  };
}

export interface RemoveMetricAction extends Action<typeof REMOVE_METRIC> {
  payload: {
    id: MetricAggregation['id'];
  };
}

export interface ChangeMetricTypeAction extends Action<typeof CHANGE_METRIC_TYPE> {
  payload: {
    id: MetricAggregation['id'];
    type: MetricAggregation['type'];
  };
}

export interface ChangeMetricFieldAction extends Action<typeof CHANGE_METRIC_FIELD> {
  payload: {
    id: MetricAggregation['id'];
    field: string;
  };
}
export interface ToggleMetricVisibilityAction extends Action<typeof TOGGLE_METRIC_VISIBILITY> {
  payload: {
    id: MetricAggregation['id'];
  };
}

export type MetricAggregationAction =
  | AddMetricAction
  | RemoveMetricAction
  | ChangeMetricTypeAction
  | ChangeMetricFieldAction
  | ToggleMetricVisibilityAction;

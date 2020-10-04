import { Action } from '../../hooks/useReducerCallback';

export const ADD_METRIC = '@metrics/add';
export const REMOVE_METRIC = '@metrics/remove';
export const CHANGE_METRIC_TYPE = '@metrics/change_type';

export type MetricAggregationType =
  | 'count'
  | 'avg'
  | 'sum'
  | 'min'
  | 'max'
  | 'extended_stats'
  | 'percentiles'
  | 'moving_avg'
  | 'moving_fn'
  | 'cardinality'
  | 'derivative'
  | 'cumulative_sum'
  | 'bucket_script'
  | 'raw_document'
  | 'raw_data'
  | 'logs';

interface PipelineVariable {
  name: string;
  pipelineAgg: string;
}

export interface MetricAggregation {
  id: string;
  type: MetricAggregationType;
  hide: boolean;
  settings?: unknown;
  field?: string;
  pipelineVariables?: PipelineVariable[];
}

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

export type MetricAggregationAction = AddMetricAction | RemoveMetricAction | ChangeMetricTypeAction;

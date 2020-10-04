import { Action } from '../../hooks/useReducerCallback';

export const ADD_METRIC = '@metrics/add';
export const REMOVE_METRIC = '@metrics/remove';

export type MetricAggregationType =
  | 'count'
  | 'avg'
  | 'sum'
  | 'min'
  | 'max'
  | 'extended_stats'
  | 'percentiles'
  | 'moving_avg'
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
  id: number;
  type: MetricAggregationType;
  hide: boolean;
  settings?: unknown;
  field?: string;
  pipelineVariables?: PipelineVariable[];
}

// Action Types

export interface AddMetricAction extends Action<typeof ADD_METRIC> {
  payload: {
    metricType: MetricAggregationType;
  };
}

export interface RemoveMetricAction extends Action<typeof REMOVE_METRIC> {
  payload: {
    id: number;
  };
}

export type MetricAggregationAction = AddMetricAction | RemoveMetricAction;

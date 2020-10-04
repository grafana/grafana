import { Action } from '../../hooks/useReducerCallback';

export const ADD_METRIC = '@mtrics/add';
export const REMOVE_METRIC = '@mtrics/remove';

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

export interface MetricAggregation {
  id: string;
  type: MetricAggregationType;
  hide: boolean;
  settings?: unknown;
}

// Action Types

export interface AddMetricAction extends Action<typeof ADD_METRIC> {
  payload: {
    metricType: MetricAggregationType;
    index: number;
  };
}

export interface RemoveMetricAction extends Action<typeof REMOVE_METRIC> {
  payload: {
    id: string;
  };
}

export type MetricAggregationAction = AddMetricAction | RemoveMetricAction;

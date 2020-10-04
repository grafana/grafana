import { ADD_METRIC, REMOVE_METRIC, MetricAggregationAction, MetricAggregationType } from './types';

export const addMetric = (metricType: MetricAggregationType, index: number): MetricAggregationAction => ({
  type: ADD_METRIC,
  payload: {
    metricType,
    index,
  },
});

export const removeMetric = (id: string): MetricAggregationAction => ({
  type: REMOVE_METRIC,
  payload: {
    id,
  },
});

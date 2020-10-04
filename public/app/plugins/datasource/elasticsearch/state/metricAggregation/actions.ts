import { ADD_METRIC, REMOVE_METRIC, MetricAggregationAction, MetricAggregationType } from './types';

export const addMetric = (metricType: MetricAggregationType): MetricAggregationAction => ({
  type: ADD_METRIC,
  payload: {
    metricType,
  },
});

export const removeMetric = (id: number): MetricAggregationAction => ({
  type: REMOVE_METRIC,
  payload: {
    id,
  },
});

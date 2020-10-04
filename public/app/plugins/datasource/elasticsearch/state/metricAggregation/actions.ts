import { ADD_METRIC, REMOVE_METRIC, MetricAggregationAction, CHANGE_METRIC_TYPE, MetricAggregation } from './types';

export const addMetric = (metricType: MetricAggregation['type']): MetricAggregationAction => ({
  type: ADD_METRIC,
  payload: {
    metricType,
  },
});

export const removeMetric = (id: MetricAggregation['id']): MetricAggregationAction => ({
  type: REMOVE_METRIC,
  payload: {
    id,
  },
});

export const changeMetricType = (
  id: MetricAggregation['id'],
  type: MetricAggregation['type']
): MetricAggregationAction => ({
  type: CHANGE_METRIC_TYPE,
  payload: {
    id,
    type,
  },
});

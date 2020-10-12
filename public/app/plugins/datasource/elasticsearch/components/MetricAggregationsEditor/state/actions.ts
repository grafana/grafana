import {
  ADD_METRIC,
  CHANGE_METRIC_FIELD,
  CHANGE_METRIC_TYPE,
  REMOVE_METRIC,
  TOGGLE_METRIC_VISIBILITY,
  MetricAggregation,
  MetricAggregationAction,
} from './types';

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

export const changeMetricField = (id: MetricAggregation['id'], field: string): MetricAggregationAction => ({
  type: CHANGE_METRIC_FIELD,
  payload: {
    id,
    field,
  },
});

export const toggleMetricVisibility = (id: MetricAggregation['id']): MetricAggregationAction => ({
  type: TOGGLE_METRIC_VISIBILITY,
  payload: {
    id,
  },
});

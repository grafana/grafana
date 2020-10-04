import { ADD_METRIC, MetricAggregation, MetricAggregationAction, REMOVE_METRIC } from './types';

export const reducer = (state: MetricAggregation[], action: MetricAggregationAction) => {
  switch (action.type) {
    case ADD_METRIC:
      return [...state];
    case REMOVE_METRIC:
      return state.filter(metric => metric.id !== action.payload.id);
  }
};

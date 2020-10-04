import { defaultMetricAgg } from '../../query_def';
import { ADD_METRIC, CHANGE_METRIC_TYPE, MetricAggregation, MetricAggregationAction, REMOVE_METRIC } from './types';

export const reducer = (state: MetricAggregation[] = [], action: MetricAggregationAction) => {
  switch (action.type) {
    case ADD_METRIC:
      const nextId = parseInt(state[state.length - 1].id, 10) + 1;
      return [...state, defaultMetricAgg(nextId.toString())];
    case REMOVE_METRIC:
      return state.filter(metric => metric.id !== action.payload.id);
    case CHANGE_METRIC_TYPE:
      // TODO: Here we should do some checks to clean out metric configurations that are not compatible
      // with the new one (eg `settings` or `field`)

      return state.map(metric => {
        if (metric.id !== action.payload.id) {
          return metric;
        }

        return {
          ...metric,
          type: action.payload.type,
        };
      });

    default:
      return state;
  }
};

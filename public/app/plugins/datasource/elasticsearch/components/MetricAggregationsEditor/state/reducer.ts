import { defaultMetricAgg } from '../../../query_def';
import { ElasticsearchQuery } from '../../../types';
import { getAncestors } from '../utils';
import {
  ADD_METRIC,
  CHANGE_METRIC_TYPE,
  REMOVE_METRIC,
  TOGGLE_METRIC_VISIBILITY,
  MetricAggregation,
  MetricAggregationAction,
  CHANGE_METRIC_FIELD,
} from './types';

export const reducer = (
  state: MetricAggregation[] = [],
  action: MetricAggregationAction
): ElasticsearchQuery['metrics'] => {
  switch (action.type) {
    case ADD_METRIC:
      const nextId = parseInt(state[state.length - 1].id, 10) + 1;
      return [...state, defaultMetricAgg(nextId.toString())];
    case REMOVE_METRIC:
      const metricToRemove = state.find(m => m.id === action.payload.id)!;
      const metricsToRemove = [metricToRemove, ...getAncestors(metricToRemove, state)];
      const resultingMetrics = state.filter(metric => !metricsToRemove.some(toRemove => toRemove.id === metric.id));
      return resultingMetrics;
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

    case CHANGE_METRIC_FIELD:
      return state.map(metric => {
        if (metric.id !== action.payload.id) {
          return metric;
        }

        return {
          ...metric,
          field: action.payload.field,
        };
      });

    case TOGGLE_METRIC_VISIBILITY:
      return state.map(metric => {
        if (metric.id !== action.payload.id) {
          return metric;
        }

        return {
          ...metric,
          hide: !metric.hide,
        };
      });

    default:
      return state;
  }
};

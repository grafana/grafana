import { defaultMetricAgg } from '../../../query_def';
import { ElasticsearchQuery } from '../../../types';
import { getChildren, metricAggregationConfig } from '../utils';
import {
  ADD_METRIC,
  CHANGE_METRIC_TYPE,
  REMOVE_METRIC,
  TOGGLE_METRIC_VISIBILITY,
  MetricAggregation,
  MetricAggregationAction,
  CHANGE_METRIC_FIELD,
  CHANGE_METRIC_SETTING,
  CHANGE_METRIC_META,
  isMetricAggregationWithSettings,
  isMetricAggregationWithMeta,
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
      const metricsToRemove = [metricToRemove, ...getChildren(metricToRemove, state)];
      const resultingMetrics = state.filter(metric => !metricsToRemove.some(toRemove => toRemove.id === metric.id));
      return resultingMetrics;

    case CHANGE_METRIC_TYPE:
      return state
        .filter(metric =>
          // When the new metric type is `isSingleMetric` we remove all other metrics from the query
          // TODO: This needs to be also done in the Bucket Aggregation reducer
          !!metricAggregationConfig[action.payload.type].isSingleMetric ? metric.id === action.payload.id : true
        )
        .map(metric => {
          if (metric.id !== action.payload.id) {
            return metric;
          }

          // TODO: Here we should do some checks to clean out metric configurations that are not compatible
          // with the new one (eg. `settings` or `field`)
          return {
            ...metric,
            type: action.payload.type,
          } as MetricAggregation;
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

    case CHANGE_METRIC_SETTING:
      return state.map(metric => {
        if (metric.id !== action.payload.metric.id) {
          return metric;
        }

        if (isMetricAggregationWithSettings(metric)) {
          // FIXME: this can be done in a better way, also romeving empty objects
          const newSettings = Object.entries({
            ...metric.settings,
            [action.payload.setting]: action.payload.newValue,
          }).reduce((acc, [key, value]) => {
            if (value?.length === 0) {
              return { ...acc };
            }
            return {
              ...acc,
              [key]: value,
            };
          }, {});

          return {
            ...metric,
            settings: {
              ...newSettings,
            },
          };
        }
        // This should never happen.
        return metric;
      });

    case CHANGE_METRIC_META:
      return state.map(metric => {
        if (metric.id !== action.payload.metric.id) {
          return metric;
        }

        if (isMetricAggregationWithMeta(metric)) {
          return {
            ...metric,
            meta: {
              ...metric.meta,
              [action.payload.meta]: action.payload.newValue,
            },
          };
        }
        // This should never happen.
        return metric;
      });

    default:
      return state;
  }
};

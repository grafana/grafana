import { defaultMetricAgg } from '../../../../query_def';
import { ElasticsearchQuery } from '../../../../types';
import { removeEmpty } from '../../../../utils';
import { INIT, InitAction } from '../../state';
import {
  isMetricAggregationWithMeta,
  isMetricAggregationWithSettings,
  isPipelineAggregation,
  MetricAggregation,
} from '../aggregations';
import { getChildren, metricAggregationConfig } from '../utils';
import {
  ADD_METRIC,
  CHANGE_METRIC_TYPE,
  REMOVE_METRIC,
  TOGGLE_METRIC_VISIBILITY,
  MetricAggregationAction,
  CHANGE_METRIC_FIELD,
  CHANGE_METRIC_SETTING,
  CHANGE_METRIC_META,
  CHANGE_METRIC_ATTRIBUTE,
} from './types';

export const reducer = (
  state: ElasticsearchQuery['metrics'],
  action: MetricAggregationAction | InitAction
): ElasticsearchQuery['metrics'] => {
  switch (action.type) {
    case ADD_METRIC:
      return [...state!, defaultMetricAgg(action.payload.id)];

    case REMOVE_METRIC:
      const metricToRemove = state!.find((m) => m.id === action.payload.id)!;
      const metricsToRemove = [metricToRemove, ...getChildren(metricToRemove, state!)];
      const resultingMetrics = state!.filter(
        (metric) => !metricsToRemove.some((toRemove) => toRemove.id === metric.id)
      );
      if (resultingMetrics.length === 0) {
        return [defaultMetricAgg('1')];
      }
      return resultingMetrics;

    case CHANGE_METRIC_TYPE:
      return state!
        .filter((metric) =>
          // When the new metric type is `isSingleMetric` we remove all other metrics from the query
          // leaving only the current one.
          !!metricAggregationConfig[action.payload.type].isSingleMetric ? metric.id === action.payload.id : true
        )
        .map((metric) => {
          if (metric.id !== action.payload.id) {
            return metric;
          }

          /*
            TODO: The previous version of the query editor was keeping some of the old metric's configurations
            in the new selected one (such as field or some settings).
            It the future would be nice to have the same behavior but it's hard without a proper definition,
            as Elasticsearch will error sometimes if some settings are not compatible.
          */
          return {
            id: metric.id,
            type: action.payload.type,
            ...metricAggregationConfig[action.payload.type].defaults,
          } as MetricAggregation;
        });

    case CHANGE_METRIC_FIELD:
      return state!.map((metric) => {
        if (metric.id !== action.payload.id) {
          return metric;
        }

        const newMetric = {
          ...metric,
          field: action.payload.field,
        };

        if (isPipelineAggregation(metric)) {
          return { ...newMetric, pipelineAgg: action.payload.field };
        }

        return newMetric;
      });

    case TOGGLE_METRIC_VISIBILITY:
      return state!.map((metric) => {
        if (metric.id !== action.payload.id) {
          return metric;
        }

        return {
          ...metric,
          hide: !metric.hide,
        };
      });

    case CHANGE_METRIC_SETTING:
      return state!.map((metric) => {
        if (metric.id !== action.payload.metric.id) {
          return metric;
        }

        // TODO: Here, instead of this if statement, we should assert that metric is MetricAggregationWithSettings
        if (isMetricAggregationWithSettings(metric)) {
          const newSettings = removeEmpty({
            ...metric.settings,
            [action.payload.settingName]: action.payload.newValue,
          });

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
      return state!.map((metric) => {
        if (metric.id !== action.payload.metric.id) {
          return metric;
        }

        // TODO: Here, instead of this if statement, we should assert that metric is MetricAggregationWithMeta
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

    case CHANGE_METRIC_ATTRIBUTE:
      return state!.map((metric) => {
        if (metric.id !== action.payload.metric.id) {
          return metric;
        }

        return {
          ...metric,
          [action.payload.attribute]: action.payload.newValue,
        };
      });

    case INIT:
      if (state?.length || 0 > 0) {
        return state;
      }
      return [defaultMetricAgg('1')];

    default:
      return state;
  }
};

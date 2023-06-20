import { Action } from '@reduxjs/toolkit';

import { defaultMetricAgg } from '../../../../queryDef';
import { ElasticsearchQuery, MetricAggregation } from '../../../../types';
import { removeEmpty } from '../../../../utils';
import { initQuery } from '../../state';
import { isMetricAggregationWithMeta, isMetricAggregationWithSettings, isPipelineAggregation } from '../aggregations';
import { getChildren, metricAggregationConfig } from '../utils';

import {
  addMetric,
  changeMetricAttribute,
  changeMetricField,
  changeMetricMeta,
  changeMetricSetting,
  changeMetricType,
  removeMetric,
  toggleMetricVisibility,
} from './actions';

export const reducer = (state: ElasticsearchQuery['metrics'], action: Action): ElasticsearchQuery['metrics'] => {
  if (addMetric.match(action)) {
    return [...state!, defaultMetricAgg(action.payload)];
  }

  if (removeMetric.match(action)) {
    const metricToRemove = state!.find((m) => m.id === action.payload)!;
    const metricsToRemove = [metricToRemove, ...getChildren(metricToRemove, state!)];
    const resultingMetrics = state!.filter((metric) => !metricsToRemove.some((toRemove) => toRemove.id === metric.id));
    if (resultingMetrics.length === 0) {
      return [defaultMetricAgg('1')];
    }
    return resultingMetrics;
  }

  if (changeMetricType.match(action)) {
    return state!
      .filter((metric) =>
        // When the new query type is not `metrics` we remove all other metrics from the query
        // leaving only the current one.
        metricAggregationConfig[action.payload.type].impliedQueryType === 'metrics'
          ? true
          : metric.id === action.payload.id
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
  }

  if (changeMetricField.match(action)) {
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
  }

  if (toggleMetricVisibility.match(action)) {
    return state!.map((metric) => {
      if (metric.id !== action.payload) {
        return metric;
      }

      return {
        ...metric,
        hide: !metric.hide,
      };
    });
  }

  if (changeMetricSetting.match(action)) {
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
  }

  if (changeMetricMeta.match(action)) {
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
  }

  if (changeMetricAttribute.match(action)) {
    return state!.map((metric) => {
      if (metric.id !== action.payload.metric.id) {
        return metric;
      }

      return {
        ...metric,
        [action.payload.attribute]: action.payload.newValue,
      };
    });
  }

  if (initQuery.match(action)) {
    if (state && state.length > 0) {
      return state;
    }
    return [defaultMetricAgg('1')];
  }

  return state;
};

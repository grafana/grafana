import { Action } from '@reduxjs/toolkit';

import { defaultBucketAgg } from '../../../../queryDef';
import { ElasticsearchQuery } from '../../../../types';
import { removeEmpty } from '../../../../utils';
import { changeMetricType } from '../../MetricAggregationsEditor/state/actions';
import { metricAggregationConfig } from '../../MetricAggregationsEditor/utils';
import { initQuery } from '../../state';
import { BucketAggregation, Terms } from '../aggregations';
import { bucketAggregationConfig } from '../utils';

import {
  addBucketAggregation,
  changeBucketAggregationField,
  changeBucketAggregationSetting,
  changeBucketAggregationType,
  removeBucketAggregation,
} from './actions';

export const createReducer =
  (defaultTimeField: string) =>
  (state: ElasticsearchQuery['bucketAggs'], action: Action): ElasticsearchQuery['bucketAggs'] => {
    if (addBucketAggregation.match(action)) {
      const newAgg: Terms = {
        id: action.payload,
        type: 'terms',
        settings: bucketAggregationConfig['terms'].defaultSettings,
      };

      // If the last bucket aggregation is a `date_histogram` we add the new one before it.
      const lastAgg = state![state!.length - 1];
      if (lastAgg?.type === 'date_histogram') {
        return [...state!.slice(0, state!.length - 1), newAgg, lastAgg];
      }

      return [...state!, newAgg];
    }

    if (removeBucketAggregation.match(action)) {
      return state!.filter((bucketAgg) => bucketAgg.id !== action.payload);
    }

    if (changeBucketAggregationType.match(action)) {
      return state!.map((bucketAgg) => {
        if (bucketAgg.id !== action.payload.id) {
          return bucketAgg;
        }

        /*
        TODO: The previous version of the query editor was keeping some of the old bucket aggregation's configurations
        in the new selected one (such as field or some settings).
        It the future would be nice to have the same behavior but it's hard without a proper definition,
        as Elasticsearch will error sometimes if some settings are not compatible.
      */
        return {
          id: bucketAgg.id,
          type: action.payload.newType,
          settings: bucketAggregationConfig[action.payload.newType].defaultSettings,
        } as BucketAggregation;
      });
    }

    if (changeBucketAggregationField.match(action)) {
      return state!.map((bucketAgg) => {
        if (bucketAgg.id !== action.payload.id) {
          return bucketAgg;
        }

        return {
          ...bucketAgg,
          field: action.payload.newField,
        };
      });
    }

    if (changeMetricType.match(action)) {
      // If we are switching to a metric which requires the absence of bucket aggregations
      // we remove all of them.
      if (metricAggregationConfig[action.payload.type].isSingleMetric) {
        return [];
      } else if (state!.length === 0) {
        // Else, if there are no bucket aggregations we restore a default one.
        // This happens when switching from a metric that requires the absence of bucket aggregations to
        // one that requires it.
        return [{ ...defaultBucketAgg('2'), field: defaultTimeField }];
      }
      return state;
    }

    if (changeBucketAggregationSetting.match(action)) {
      return state!.map((bucketAgg) => {
        if (bucketAgg.id !== action.payload.bucketAgg.id) {
          return bucketAgg;
        }

        const newSettings = removeEmpty({
          ...bucketAgg.settings,
          [action.payload.settingName]: action.payload.newValue,
        });

        return {
          ...bucketAgg,
          settings: {
            ...newSettings,
          },
        };
      });
    }

    if (initQuery.match(action)) {
      if (state?.length || 0 > 0) {
        return state;
      }

      return [{ ...defaultBucketAgg('2'), field: defaultTimeField }];
    }

    return state;
  };

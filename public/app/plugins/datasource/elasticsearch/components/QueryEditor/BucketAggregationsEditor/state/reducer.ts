import { defaultBucketAgg } from '../../../../query_def';
import { ElasticsearchQuery } from '../../../../types';
import { ChangeMetricTypeAction, CHANGE_METRIC_TYPE } from '../../MetricAggregationsEditor/state/types';
import { metricAggregationConfig } from '../../MetricAggregationsEditor/utils';
import { BucketAggregation, Terms } from '../aggregations';
import { INIT, InitAction } from '../../state';
import {
  ADD_BUCKET_AGG,
  REMOVE_BUCKET_AGG,
  CHANGE_BUCKET_AGG_TYPE,
  CHANGE_BUCKET_AGG_FIELD,
  CHANGE_BUCKET_AGG_SETTING,
  BucketAggregationAction,
} from './types';
import { bucketAggregationConfig } from '../utils';
import { removeEmpty } from '../../../../utils';

export const reducer = (
  state: BucketAggregation[],
  action: BucketAggregationAction | ChangeMetricTypeAction | InitAction
): ElasticsearchQuery['bucketAggs'] => {
  switch (action.type) {
    case ADD_BUCKET_AGG:
      const newAgg: Terms = {
        id: action.payload.id,
        type: 'terms',
        settings: bucketAggregationConfig['terms'].defaultSettings,
      };

      // If the last bucket aggregation is a `date_histogram` we add the new one before it.
      const lastAgg = state[state.length - 1];
      if (lastAgg?.type === 'date_histogram') {
        return [...state.slice(0, state.length - 1), newAgg, lastAgg];
      }

      return [...state, newAgg];

    case REMOVE_BUCKET_AGG:
      return state.filter((bucketAgg) => bucketAgg.id !== action.payload.id);

    case CHANGE_BUCKET_AGG_TYPE:
      return state.map((bucketAgg) => {
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

    case CHANGE_BUCKET_AGG_FIELD:
      return state.map((bucketAgg) => {
        if (bucketAgg.id !== action.payload.id) {
          return bucketAgg;
        }

        return {
          ...bucketAgg,
          field: action.payload.newField,
        };
      });

    case CHANGE_METRIC_TYPE:
      // If we are switching to a metric which requires the absence of bucket aggregations
      // we remove all of them.
      if (metricAggregationConfig[action.payload.type].isSingleMetric) {
        return [];
      } else if (state.length === 0) {
        // Else, if there are no bucket aggregations we restore a default one.
        // This happens when switching from a metric that requires the absence of bucket aggregations to
        // one that requires it.
        return [defaultBucketAgg()];
      }
      return state;

    case CHANGE_BUCKET_AGG_SETTING:
      return state.map((bucketAgg) => {
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

    case INIT:
      return [defaultBucketAgg('2')];

    default:
      return state;
  }
};

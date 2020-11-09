import { defaultBucketAgg } from '../../../query_def';
import { ElasticsearchQuery } from '../../../types';
import { ChangeMetricTypeAction, CHANGE_METRIC_TYPE } from '../../MetricAggregationsEditor/state/types';
import { metricAggregationConfig } from '../../MetricAggregationsEditor/utils';
import {
  ADD_BUCKET_AGG,
  BucketAggregation,
  BucketAggregationAction,
  REMOVE_BUCKET_AGG,
  CHANGE_BUCKET_AGG_TYPE,
  CHANGE_BUCKET_AGG_FIELD,
  CHANGE_BUCKET_AGG_SETTING,
} from './types';

export const reducer = (
  state: BucketAggregation[] = [],
  action: BucketAggregationAction | ChangeMetricTypeAction
): ElasticsearchQuery['bucketAggs'] => {
  switch (action.type) {
    case ADD_BUCKET_AGG:
      // TODO: if last is date histogram add it before
      const nextId = parseInt(state[state.length - 1].id, 10) + 1;
      return [...state, defaultBucketAgg(nextId.toString())];

    case REMOVE_BUCKET_AGG:
      return state.filter(bucketAgg => bucketAgg.id !== action.payload.id);

    case CHANGE_BUCKET_AGG_TYPE:
      return state.map(bucketAgg => {
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
        };
      });

    case CHANGE_BUCKET_AGG_FIELD:
      return state.map(bucketAgg => {
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
      return state.map(bucketAgg => {
        if (bucketAgg.id !== action.payload.bucketAgg.id) {
          return bucketAgg;
        }

        // FIXME: this can be done in a better way, also romeving empty objects
        // Also, can be extracted to be in common with the one for metrics
        const newSettings = Object.entries({
          ...bucketAgg.settings,
          [action.payload.settingName]: action.payload.newValue,
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
          ...bucketAgg,
          settings: {
            ...newSettings,
          },
        };
      });

    default:
      return state;
  }
};

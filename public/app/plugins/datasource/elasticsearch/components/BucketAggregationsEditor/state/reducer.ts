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
} from './types';

export const reducer = (
  state: BucketAggregation[] = [],
  action: BucketAggregationAction | ChangeMetricTypeAction
): ElasticsearchQuery['bucketAggs'] => {
  switch (action.type) {
    case ADD_BUCKET_AGG:
      const nextId = parseInt(state[state.length - 1].id, 10) + 1;
      return [...state, defaultBucketAgg(nextId.toString())];

    case REMOVE_BUCKET_AGG:
      return state.filter(bucketAgg => bucketAgg.id !== action.payload.id);

    case CHANGE_BUCKET_AGG_TYPE:
      return state.map(bucketAgg => {
        if (bucketAgg.id !== action.payload.id) {
          return bucketAgg;
        }

        // TODO: Here we should do some checks to clean out bucketAgg configurations that are not compatible
        // with the new one and apply default settings for that metric.
        return {
          ...bucketAgg,
          type: action.payload.newType,
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

    default:
      return state;
  }
};

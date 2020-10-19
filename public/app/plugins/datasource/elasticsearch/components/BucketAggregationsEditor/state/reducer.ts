import { defaultBucketAgg } from '../../../query_def';
import { ElasticsearchQuery } from '../../../types';
import { ChangeMetricTypeAction, CHANGE_METRIC_TYPE } from '../../MetricAggregationsEditor/state/types';
import { metricAggregationConfig } from '../../MetricAggregationsEditor/utils';
import { ADD_BUCKET_AGG, BucketAggregation, BucketAggregationAction, REMOVE_BUCKET_AGG } from './types';

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

    case CHANGE_METRIC_TYPE:
      if (metricAggregationConfig[action.payload.type].isSingleMetric) {
        return [];
      } else if (state.length === 0) {
        // This means we are switching back to a metric that has `isSingleMetric = false`,
        // therefore we restore a default bucket aggregation
        return [defaultBucketAgg()];
      }
      return state;

    default:
      return state;
  }
};

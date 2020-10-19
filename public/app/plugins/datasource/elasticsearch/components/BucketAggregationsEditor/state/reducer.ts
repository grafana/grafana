import { defaultBucketAgg } from '../../../query_def';
import { BucketAggregation, ElasticsearchQuery } from '../../../types';
import { ADD_BUCKET_AGG, BucketAggregationAction, REMOVE_BUCKET_AGG } from './types';

export const reducer = (
  state: BucketAggregation[] = [],
  action: BucketAggregationAction
): ElasticsearchQuery['bucketAggs'] => {
  switch (action.type) {
    case ADD_BUCKET_AGG:
      const nextId = parseInt(state[state.length - 1].id, 10) + 1;
      return [...state, defaultBucketAgg(nextId.toString())];

    case REMOVE_BUCKET_AGG:
      return state.filter(bucketAgg => bucketAgg.id !== action.payload.id);

    default:
      return state;
  }
};

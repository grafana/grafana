import { ADD_BUCKET_AGG, BucketAggregation, BucketAggregationAction, REMOVE_BUCKET_AGG } from './types';

export const addBucketAggregation = (aggregationType: BucketAggregation['type']): BucketAggregationAction => ({
  type: ADD_BUCKET_AGG,
  payload: {
    aggregationType,
  },
});

export const removeBucketAggregation = (id: BucketAggregation['id']): BucketAggregationAction => ({
  type: REMOVE_BUCKET_AGG,
  payload: {
    id,
  },
});

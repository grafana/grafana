import { Action } from '../../../hooks/useReducerCallback';
import { BucketAggregation } from '../../../types';

export const ADD_BUCKET_AGG = '@bucketAggs/add';
export const REMOVE_BUCKET_AGG = '@bucketAggs/remove';

//
// Action Types
export interface AddBucketAggregationAction extends Action<typeof ADD_BUCKET_AGG> {
  payload: {
    aggregationType: BucketAggregation['type'];
  };
}

export interface RemoveBucketAggregationAction extends Action<typeof REMOVE_BUCKET_AGG> {
  payload: {
    id: BucketAggregation['id'];
  };
}

export type BucketAggregationAction = AddBucketAggregationAction | RemoveBucketAggregationAction;

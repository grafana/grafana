import { Action } from '../../../hooks/useReducerCallback';

export const ADD_BUCKET_AGG = '@bucketAggs/add';
export const REMOVE_BUCKET_AGG = '@bucketAggs/remove';

export type BucketAggregationType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram';

interface BaseBucketAggregation {
  id: string;
  type: BucketAggregationType;
  field?: string;
}

interface DateHistogram extends BaseBucketAggregation {
  type: 'date_histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
    trimEdges?: string;
    offset?: string;
  };
}

export type BucketAggregation = DateHistogram;

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

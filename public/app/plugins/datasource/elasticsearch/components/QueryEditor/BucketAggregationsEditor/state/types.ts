import { Action } from '../../../../hooks/useStatelessReducer';
import { SettingKeyOf } from '../../../types';
import { BucketAggregation, BucketAggregationWithField } from '../aggregations';

export const ADD_BUCKET_AGG = '@bucketAggs/add';
export const REMOVE_BUCKET_AGG = '@bucketAggs/remove';
export const CHANGE_BUCKET_AGG_TYPE = '@bucketAggs/change_type';
export const CHANGE_BUCKET_AGG_FIELD = '@bucketAggs/change_field';
export const CHANGE_BUCKET_AGG_SETTING = '@bucketAggs/change_setting';

export interface AddBucketAggregationAction extends Action<typeof ADD_BUCKET_AGG> {
  payload: {
    id: BucketAggregation['id'];
  };
}

export interface RemoveBucketAggregationAction extends Action<typeof REMOVE_BUCKET_AGG> {
  payload: {
    id: BucketAggregation['id'];
  };
}

export interface ChangeBucketAggregationTypeAction extends Action<typeof CHANGE_BUCKET_AGG_TYPE> {
  payload: {
    id: BucketAggregation['id'];
    newType: BucketAggregation['type'];
  };
}

export interface ChangeBucketAggregationFieldAction extends Action<typeof CHANGE_BUCKET_AGG_FIELD> {
  payload: {
    id: BucketAggregation['id'];
    newField: BucketAggregationWithField['field'];
  };
}

export interface ChangeBucketAggregationSettingAction<T extends BucketAggregation>
  extends Action<typeof CHANGE_BUCKET_AGG_SETTING> {
  payload: {
    bucketAgg: T;
    settingName: SettingKeyOf<T>;
    newValue: unknown;
  };
}

export type BucketAggregationAction<T extends BucketAggregation = BucketAggregation> =
  | AddBucketAggregationAction
  | RemoveBucketAggregationAction
  | ChangeBucketAggregationTypeAction
  | ChangeBucketAggregationFieldAction
  | ChangeBucketAggregationSettingAction<T>;

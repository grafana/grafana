import { SettingKeyOf } from '../../types';
import {
  ADD_BUCKET_AGG,
  BucketAggregation,
  BucketAggregationAction,
  REMOVE_BUCKET_AGG,
  CHANGE_BUCKET_AGG_TYPE,
  CHANGE_BUCKET_AGG_FIELD,
  BucketAggregationWithField,
  CHANGE_BUCKET_AGG_SETTING,
  ChangeBucketAggregationSettingAction,
} from './types';

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

export const changeBucketAggregationType = (
  id: BucketAggregation['id'],
  newType: BucketAggregation['type']
): BucketAggregationAction => ({
  type: CHANGE_BUCKET_AGG_TYPE,
  payload: {
    id,
    newType,
  },
});

export const changeBucketAggregationField = (
  id: BucketAggregationWithField['id'],
  newField: BucketAggregationWithField['field']
): BucketAggregationAction => ({
  type: CHANGE_BUCKET_AGG_FIELD,
  payload: {
    id,
    newField,
  },
});

export const changeBucketAggregationSetting = <T extends BucketAggregation, K extends SettingKeyOf<T>>(
  bucketAgg: T,
  settingName: K,
  // This could be inferred from T, but it's causing some troubles
  newValue: string | string[] | any
): ChangeBucketAggregationSettingAction<T> => ({
  type: CHANGE_BUCKET_AGG_SETTING,
  payload: {
    bucketAgg,
    settingName,
    newValue,
  },
});

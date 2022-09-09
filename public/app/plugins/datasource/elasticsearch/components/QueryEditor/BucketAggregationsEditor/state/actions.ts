import { createAction } from '@reduxjs/toolkit';

import {
  BucketAggregation,
  BucketAggregationType,
  BucketAggregationWithField,
  BucketAggregationWithSettings,
} from '../aggregations';

export const addBucketAggregation = createAction<BucketAggregation['id']>('@bucketAggs/add');
export const removeBucketAggregation = createAction<BucketAggregation['id']>('@bucketAggs/remove');
export const changeBucketAggregationType = createAction<{
  id: BucketAggregation['id'];
  newType: BucketAggregationType;
}>('@bucketAggs/change_type');
export const changeBucketAggregationField = createAction<{
  id: BucketAggregationWithField['id'];
  newField: BucketAggregationWithField['field'];
}>('@bucketAggs/change_field');
export const changeBucketAggregationSetting = createAction<{
  bucketAgg: BucketAggregationWithSettings;
  settingName: string;
  newValue: any;
}>('@bucketAggs/change_setting');

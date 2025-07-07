import { createAction } from '@reduxjs/toolkit';

import {
  BucketAggregation,
  BucketAggregationType,
  BucketAggregationWithField,
} from 'app/plugins/datasource/elasticsearch/dataquery.gen';

export const addBucketAggregation = createAction<BucketAggregation['id']>('@bucketAggs/add');
export const removeBucketAggregation = createAction<BucketAggregation['id']>('@bucketAggs/remove');
export const changeBucketAggregationType = createAction<{
  id: BucketAggregation['id'];
  newType: BucketAggregationType;
}>('@bucketAggs/change_type');
export const changeBucketAggregationField = createAction<{
  id: BucketAggregation['id'];
  newField: BucketAggregationWithField['field'];
}>('@bucketAggs/change_field');
export const changeBucketAggregationSetting = createAction<{
  bucketAgg: BucketAggregation;
  settingName: string;
  newValue: unknown;
}>('@bucketAggs/change_setting');

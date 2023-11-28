import { createAction } from '@reduxjs/toolkit';
export const addBucketAggregation = createAction('@bucketAggs/add');
export const removeBucketAggregation = createAction('@bucketAggs/remove');
export const changeBucketAggregationType = createAction('@bucketAggs/change_type');
export const changeBucketAggregationField = createAction('@bucketAggs/change_field');
export const changeBucketAggregationSetting = createAction('@bucketAggs/change_setting');
//# sourceMappingURL=actions.js.map
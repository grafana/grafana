import { createAction } from '@reduxjs/toolkit';
export var addBucketAggregation = createAction('@bucketAggs/add');
export var removeBucketAggregation = createAction('@bucketAggs/remove');
export var changeBucketAggregationType = createAction('@bucketAggs/change_type');
export var changeBucketAggregationField = createAction('@bucketAggs/change_field');
export var changeBucketAggregationSetting = createAction('@bucketAggs/change_setting');
//# sourceMappingURL=actions.js.map
import { BucketAggregation, BucketAggregationWithField, BucketAggregationType } from '../../../dataquery.gen';

import { bucketAggregationConfig } from './utils';

export const isBucketAggregationWithField = (
  bucketAgg: BucketAggregation | BucketAggregationWithField
): bucketAgg is BucketAggregationWithField => bucketAggregationConfig[bucketAgg.type].requiresField;

export const BUCKET_AGGREGATION_TYPES: BucketAggregationType[] = [
  'date_histogram',
  'histogram',
  'terms',
  'filters',
  'geohash_grid',
  'nested',
];

export const isBucketAggregationType = (s: BucketAggregationType | string): s is BucketAggregationType =>
  BUCKET_AGGREGATION_TYPES.includes(s as BucketAggregationType);

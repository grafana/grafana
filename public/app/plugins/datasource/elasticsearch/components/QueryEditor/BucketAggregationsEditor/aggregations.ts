import { bucketAggregationConfig } from './utils';
import { BucketAggregationType, BucketAggregationWithField, BucketAggregation, Filters } from '../../../types';

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

export const isFilters = (aggregation: BucketAggregation): aggregation is Filters => aggregation.type === 'filters';

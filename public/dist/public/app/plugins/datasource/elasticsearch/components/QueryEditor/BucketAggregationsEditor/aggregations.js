import { bucketAggregationConfig } from './utils';
export const isBucketAggregationWithField = (bucketAgg) => bucketAggregationConfig[bucketAgg.type].requiresField;
export const BUCKET_AGGREGATION_TYPES = [
    'date_histogram',
    'histogram',
    'terms',
    'filters',
    'geohash_grid',
    'nested',
];
export const isBucketAggregationType = (s) => BUCKET_AGGREGATION_TYPES.includes(s);
//# sourceMappingURL=aggregations.js.map
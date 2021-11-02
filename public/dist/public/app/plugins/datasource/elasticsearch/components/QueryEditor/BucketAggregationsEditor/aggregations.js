import { bucketAggregationConfig } from './utils';
export var isBucketAggregationWithField = function (bucketAgg) { return bucketAggregationConfig[bucketAgg.type].requiresField; };
export var BUCKET_AGGREGATION_TYPES = [
    'date_histogram',
    'histogram',
    'terms',
    'filters',
    'geohash_grid',
];
export var isBucketAggregationType = function (s) {
    return BUCKET_AGGREGATION_TYPES.includes(s);
};
//# sourceMappingURL=aggregations.js.map
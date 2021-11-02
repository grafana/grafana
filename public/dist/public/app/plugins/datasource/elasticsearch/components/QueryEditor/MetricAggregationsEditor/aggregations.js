import { metricAggregationConfig } from './utils';
export var isEWMAMovingAverage = function (metric) { var _a; return ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) === 'ewma'; };
export var isHoltMovingAverage = function (metric) { var _a; return ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) === 'holt'; };
export var isHoltWintersMovingAverage = function (metric) { var _a; return ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) === 'holt_winters'; };
export var isMovingAverageWithModelSettings = function (metric) { var _a; return ['holt', 'ewma', 'holt_winters'].includes(((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) || ''); };
// Guards
// Given the structure of the aggregations (ie. `settings` field being always optional) we cannot
// determine types based solely on objects' properties, therefore we use `metricAggregationConfig` as the
// source of truth.
/**
 * Checks if `metric` requires a field (either referring to a document or another aggregation)
 * @param metric
 */
export var isMetricAggregationWithField = function (metric) { return metricAggregationConfig[metric.type].requiresField; };
export var isPipelineAggregation = function (metric) { return metricAggregationConfig[metric.type].isPipelineAgg; };
export var isPipelineAggregationWithMultipleBucketPaths = function (metric) {
    return metricAggregationConfig[metric.type].supportsMultipleBucketPaths;
};
export var isMetricAggregationWithMissingSupport = function (metric) { return metricAggregationConfig[metric.type].supportsMissing; };
export var isMetricAggregationWithSettings = function (metric) { return metricAggregationConfig[metric.type].hasSettings; };
export var isMetricAggregationWithMeta = function (metric) { return metricAggregationConfig[metric.type].hasMeta; };
export var isMetricAggregationWithInlineScript = function (metric) { return metricAggregationConfig[metric.type].supportsInlineScript; };
export var METRIC_AGGREGATION_TYPES = [
    'count',
    'avg',
    'sum',
    'min',
    'max',
    'extended_stats',
    'percentiles',
    'cardinality',
    'raw_document',
    'raw_data',
    'logs',
    'moving_avg',
    'moving_fn',
    'derivative',
    'serial_diff',
    'cumulative_sum',
    'bucket_script',
    'rate',
    'top_metrics',
];
export var isMetricAggregationType = function (s) {
    return METRIC_AGGREGATION_TYPES.includes(s);
};
//# sourceMappingURL=aggregations.js.map
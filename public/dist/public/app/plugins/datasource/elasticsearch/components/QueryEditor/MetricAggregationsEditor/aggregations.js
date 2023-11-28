import { metricAggregationConfig } from './utils';
export const isEWMAMovingAverage = (metric) => { var _a; return ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) === 'ewma'; };
export const isHoltMovingAverage = (metric) => { var _a; return ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) === 'holt'; };
export const isHoltWintersMovingAverage = (metric) => { var _a; return ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) === 'holt_winters'; };
export const isMovingAverageWithModelSettings = (metric) => { var _a; return ['holt', 'ewma', 'holt_winters'].includes(((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model) || ''); };
// Guards
// Given the structure of the aggregations (ie. `settings` field being always optional) we cannot
// determine types based solely on objects' properties, therefore we use `metricAggregationConfig` as the
// source of truth.
/**
 * Checks if `metric` requires a field (either referring to a document or another aggregation)
 * @param metric
 */
export const isMetricAggregationWithField = (metric) => metricAggregationConfig[metric.type].requiresField;
export const isPipelineAggregation = (metric) => metricAggregationConfig[metric.type].isPipelineAgg;
export const isPipelineAggregationWithMultipleBucketPaths = (metric) => metricAggregationConfig[metric.type].supportsMultipleBucketPaths;
export const isMetricAggregationWithMissingSupport = (metric) => metricAggregationConfig[metric.type].supportsMissing;
export const isMetricAggregationWithSettings = (metric) => metricAggregationConfig[metric.type].hasSettings;
export const isMetricAggregationWithMeta = (metric) => metricAggregationConfig[metric.type].hasMeta;
export const isMetricAggregationWithInlineScript = (metric) => metricAggregationConfig[metric.type].supportsInlineScript;
export const METRIC_AGGREGATION_TYPES = [
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
export const isMetricAggregationType = (s) => METRIC_AGGREGATION_TYPES.includes(s);
//# sourceMappingURL=aggregations.js.map
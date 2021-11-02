import { metricAggregationConfig, pipelineOptions } from './components/QueryEditor/MetricAggregationsEditor/utils';
export var extendedStats = [
    { label: 'Avg', value: 'avg' },
    { label: 'Min', value: 'min' },
    { label: 'Max', value: 'max' },
    { label: 'Sum', value: 'sum' },
    { label: 'Count', value: 'count' },
    { label: 'Std Dev', value: 'std_deviation' },
    { label: 'Std Dev Upper', value: 'std_deviation_bounds_upper' },
    { label: 'Std Dev Lower', value: 'std_deviation_bounds_lower' },
];
export var movingAvgModelOptions = [
    { label: 'Simple', value: 'simple' },
    { label: 'Linear', value: 'linear' },
    { label: 'Exponentially Weighted', value: 'ewma' },
    { label: 'Holt Linear', value: 'holt' },
    { label: 'Holt Winters', value: 'holt_winters' },
];
export var highlightTags = {
    pre: '@HIGHLIGHT@',
    post: '@/HIGHLIGHT@',
};
export function defaultMetricAgg(id) {
    if (id === void 0) { id = '1'; }
    return { type: 'count', id: id };
}
export function defaultBucketAgg(id) {
    if (id === void 0) { id = '1'; }
    return { type: 'date_histogram', id: id, settings: { interval: 'auto' } };
}
export var findMetricById = function (metrics, id) {
    return metrics.find(function (metric) { return metric.id === id; });
};
export function hasMetricOfType(target, type) {
    var _a;
    return !!((_a = target === null || target === void 0 ? void 0 : target.metrics) === null || _a === void 0 ? void 0 : _a.some(function (m) { return m.type === type; }));
}
// Even if we have type guards when building a query, we currently have no way of getting this information from the response.
// We should try to find a better (type safe) way of doing the following 2.
export function isPipelineAgg(metricType) {
    return metricType in pipelineOptions;
}
export function isPipelineAggWithMultipleBucketPaths(metricType) {
    return !!metricAggregationConfig[metricType].supportsMultipleBucketPaths;
}
//# sourceMappingURL=query_def.js.map
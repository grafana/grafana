import { gte } from 'semver';
import { isMetricAggregationWithField } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
export const describeMetric = (metric) => {
    if (!isMetricAggregationWithField(metric)) {
        return metricAggregationConfig[metric.type].label;
    }
    // TODO: field might be undefined
    return `${metricAggregationConfig[metric.type].label} ${metric.field}`;
};
/**
 * Utility function to clean up aggregations settings objects.
 * It removes nullish values and empty strings, array and objects
 * recursing over nested objects (not arrays).
 * @param obj
 */
export const removeEmpty = (obj) => Object.entries(obj).reduce((acc, [key, value]) => {
    // Removing nullish values (null & undefined)
    if (value == null) {
        return Object.assign({}, acc);
    }
    // Removing empty arrays (This won't recurse the array)
    if (Array.isArray(value) && value.length === 0) {
        return Object.assign({}, acc);
    }
    // Removing empty strings
    if (typeof value === 'string' && value.length === 0) {
        return Object.assign({}, acc);
    }
    // Recursing over nested objects
    if (!Array.isArray(value) && typeof value === 'object') {
        const cleanObj = removeEmpty(value);
        if (Object.keys(cleanObj).length === 0) {
            return Object.assign({}, acc);
        }
        return Object.assign(Object.assign({}, acc), { [key]: cleanObj });
    }
    return Object.assign(Object.assign({}, acc), { [key]: value });
}, {});
/**
 *  This function converts an order by string to the correct metric id For example,
 *  if the user uses the standard deviation extended stat for the order by,
 *  the value would be "1[std_deviation]" and this would return "1"
 */
export const convertOrderByToMetricId = (orderBy) => {
    const metricIdMatches = orderBy.match(/^(\d+)/);
    return metricIdMatches ? metricIdMatches[1] : void 0;
};
/** Gets the actual script value for metrics that support inline scripts.
 *
 *  This is needed because the `script` is a bit polymorphic.
 *  when creating a query with Grafana < 7.4 it was stored as:
 * ```json
 * {
 *    "settings": {
 *      "script": {
 *        "inline": "value"
 *      }
 *    }
 * }
 * ```
 *
 * while from 7.4 it's stored as
 * ```json
 * {
 *    "settings": {
 *      "script": "value"
 *    }
 * }
 * ```
 *
 * This allows us to access both formats and support both queries created before 7.4 and after.
 */
export const getScriptValue = (metric) => { var _a, _b, _c, _d; return (typeof ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.script) === 'object' ? (_c = (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.script) === null || _c === void 0 ? void 0 : _c.inline : (_d = metric.settings) === null || _d === void 0 ? void 0 : _d.script) || ''; };
export const isSupportedVersion = (version) => {
    if (gte(version, '7.16.0')) {
        return true;
    }
    return false;
};
export const unsupportedVersionMessage = 'Support for Elasticsearch versions after their end-of-life (currently versions < 7.16) was removed. Using unsupported version of Elasticsearch may lead to unexpected and incorrect results.';
// To be considered a time series query, the last bucked aggregation must be a Date Histogram
export const isTimeSeriesQuery = (query) => {
    var _a, _b;
    return ((_b = (_a = query === null || query === void 0 ? void 0 : query.bucketAggs) === null || _a === void 0 ? void 0 : _a.slice(-1)[0]) === null || _b === void 0 ? void 0 : _b.type) === 'date_histogram';
};
//# sourceMappingURL=utils.js.map
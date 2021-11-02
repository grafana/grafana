import { __assign, __read } from "tslib";
import { isMetricAggregationWithField, } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { valid } from 'semver';
export var describeMetric = function (metric) {
    if (!isMetricAggregationWithField(metric)) {
        return metricAggregationConfig[metric.type].label;
    }
    // TODO: field might be undefined
    return metricAggregationConfig[metric.type].label + " " + metric.field;
};
/**
 * Utility function to clean up aggregations settings objects.
 * It removes nullish values and empty strings, array and objects
 * recursing over nested objects (not arrays).
 * @param obj
 */
export var removeEmpty = function (obj) {
    return Object.entries(obj).reduce(function (acc, _a) {
        var _b, _c;
        var _d = __read(_a, 2), key = _d[0], value = _d[1];
        // Removing nullish values (null & undefined)
        if (value == null) {
            return __assign({}, acc);
        }
        // Removing empty arrays (This won't recurse the array)
        if (Array.isArray(value) && value.length === 0) {
            return __assign({}, acc);
        }
        // Removing empty strings
        if ((value === null || value === void 0 ? void 0 : value.length) === 0) {
            return __assign({}, acc);
        }
        // Recursing over nested objects
        if (!Array.isArray(value) && typeof value === 'object') {
            var cleanObj = removeEmpty(value);
            if (Object.keys(cleanObj).length === 0) {
                return __assign({}, acc);
            }
            return __assign(__assign({}, acc), (_b = {}, _b[key] = cleanObj, _b));
        }
        return __assign(__assign({}, acc), (_c = {}, _c[key] = value, _c));
    }, {});
};
/**
 *  This function converts an order by string to the correct metric id For example,
 *  if the user uses the standard deviation extended stat for the order by,
 *  the value would be "1[std_deviation]" and this would return "1"
 */
export var convertOrderByToMetricId = function (orderBy) {
    var metricIdMatches = orderBy.match(/^(\d+)/);
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
export var getScriptValue = function (metric) { var _a, _b, _c, _d; return (typeof ((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.script) === 'object' ? (_c = (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.script) === null || _c === void 0 ? void 0 : _c.inline : (_d = metric.settings) === null || _d === void 0 ? void 0 : _d.script) || ''; };
/**
 * Coerces the a version string/number to a valid semver string.
 * It takes care of also converting from the legacy format (numeric) to the new one.
 * @param version
 */
export var coerceESVersion = function (version) {
    if (typeof version === 'string') {
        return valid(version) || '5.0.0';
    }
    switch (version) {
        case 2:
            return '2.0.0';
        case 56:
            return '5.6.0';
        case 60:
            return '6.0.0';
        case 70:
            return '7.0.0';
        case 5:
        default:
            return '5.0.0';
    }
};
//# sourceMappingURL=utils.js.map
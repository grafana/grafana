import { __assign, __read, __spreadArray } from "tslib";
import { defaultMetricAgg } from '../../../../query_def';
import { removeEmpty } from '../../../../utils';
import { initQuery } from '../../state';
import { isMetricAggregationWithMeta, isMetricAggregationWithSettings, isPipelineAggregation, } from '../aggregations';
import { getChildren, metricAggregationConfig } from '../utils';
import { addMetric, changeMetricAttribute, changeMetricField, changeMetricMeta, changeMetricSetting, changeMetricType, removeMetric, toggleMetricVisibility, } from './actions';
export var reducer = function (state, action) {
    if (addMetric.match(action)) {
        return __spreadArray(__spreadArray([], __read(state), false), [defaultMetricAgg(action.payload)], false);
    }
    if (removeMetric.match(action)) {
        var metricToRemove = state.find(function (m) { return m.id === action.payload; });
        var metricsToRemove_1 = __spreadArray([metricToRemove], __read(getChildren(metricToRemove, state)), false);
        var resultingMetrics = state.filter(function (metric) { return !metricsToRemove_1.some(function (toRemove) { return toRemove.id === metric.id; }); });
        if (resultingMetrics.length === 0) {
            return [defaultMetricAgg('1')];
        }
        return resultingMetrics;
    }
    if (changeMetricType.match(action)) {
        return state
            .filter(function (metric) {
            // When the new metric type is `isSingleMetric` we remove all other metrics from the query
            // leaving only the current one.
            return !!metricAggregationConfig[action.payload.type].isSingleMetric ? metric.id === action.payload.id : true;
        })
            .map(function (metric) {
            if (metric.id !== action.payload.id) {
                return metric;
            }
            /*
            TODO: The previous version of the query editor was keeping some of the old metric's configurations
            in the new selected one (such as field or some settings).
            It the future would be nice to have the same behavior but it's hard without a proper definition,
            as Elasticsearch will error sometimes if some settings are not compatible.
          */
            return __assign({ id: metric.id, type: action.payload.type }, metricAggregationConfig[action.payload.type].defaults);
        });
    }
    if (changeMetricField.match(action)) {
        return state.map(function (metric) {
            if (metric.id !== action.payload.id) {
                return metric;
            }
            var newMetric = __assign(__assign({}, metric), { field: action.payload.field });
            if (isPipelineAggregation(metric)) {
                return __assign(__assign({}, newMetric), { pipelineAgg: action.payload.field });
            }
            return newMetric;
        });
    }
    if (toggleMetricVisibility.match(action)) {
        return state.map(function (metric) {
            if (metric.id !== action.payload) {
                return metric;
            }
            return __assign(__assign({}, metric), { hide: !metric.hide });
        });
    }
    if (changeMetricSetting.match(action)) {
        return state.map(function (metric) {
            var _a;
            if (metric.id !== action.payload.metric.id) {
                return metric;
            }
            // TODO: Here, instead of this if statement, we should assert that metric is MetricAggregationWithSettings
            if (isMetricAggregationWithSettings(metric)) {
                var newSettings = removeEmpty(__assign(__assign({}, metric.settings), (_a = {}, _a[action.payload.settingName] = action.payload.newValue, _a)));
                return __assign(__assign({}, metric), { settings: __assign({}, newSettings) });
            }
            // This should never happen.
            return metric;
        });
    }
    if (changeMetricMeta.match(action)) {
        return state.map(function (metric) {
            var _a;
            if (metric.id !== action.payload.metric.id) {
                return metric;
            }
            // TODO: Here, instead of this if statement, we should assert that metric is MetricAggregationWithMeta
            if (isMetricAggregationWithMeta(metric)) {
                return __assign(__assign({}, metric), { meta: __assign(__assign({}, metric.meta), (_a = {}, _a[action.payload.meta] = action.payload.newValue, _a)) });
            }
            // This should never happen.
            return metric;
        });
    }
    if (changeMetricAttribute.match(action)) {
        return state.map(function (metric) {
            var _a;
            if (metric.id !== action.payload.metric.id) {
                return metric;
            }
            return __assign(__assign({}, metric), (_a = {}, _a[action.payload.attribute] = action.payload.newValue, _a));
        });
    }
    if (initQuery.match(action)) {
        if ((state === null || state === void 0 ? void 0 : state.length) || 0 > 0) {
            return state;
        }
        return [defaultMetricAgg('1')];
    }
    return state;
};
//# sourceMappingURL=reducer.js.map
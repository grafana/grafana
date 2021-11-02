import { __assign, __read, __spreadArray } from "tslib";
import { defaultBucketAgg } from '../../../../query_def';
import { metricAggregationConfig } from '../../MetricAggregationsEditor/utils';
import { initQuery } from '../../state';
import { bucketAggregationConfig } from '../utils';
import { removeEmpty } from '../../../../utils';
import { addBucketAggregation, changeBucketAggregationField, changeBucketAggregationSetting, changeBucketAggregationType, removeBucketAggregation, } from './actions';
import { changeMetricType } from '../../MetricAggregationsEditor/state/actions';
export var createReducer = function (defaultTimeField) { return function (state, action) {
    if (addBucketAggregation.match(action)) {
        var newAgg = {
            id: action.payload,
            type: 'terms',
            settings: bucketAggregationConfig['terms'].defaultSettings,
        };
        // If the last bucket aggregation is a `date_histogram` we add the new one before it.
        var lastAgg = state[state.length - 1];
        if ((lastAgg === null || lastAgg === void 0 ? void 0 : lastAgg.type) === 'date_histogram') {
            return __spreadArray(__spreadArray([], __read(state.slice(0, state.length - 1)), false), [newAgg, lastAgg], false);
        }
        return __spreadArray(__spreadArray([], __read(state), false), [newAgg], false);
    }
    if (removeBucketAggregation.match(action)) {
        return state.filter(function (bucketAgg) { return bucketAgg.id !== action.payload; });
    }
    if (changeBucketAggregationType.match(action)) {
        return state.map(function (bucketAgg) {
            if (bucketAgg.id !== action.payload.id) {
                return bucketAgg;
            }
            /*
              TODO: The previous version of the query editor was keeping some of the old bucket aggregation's configurations
              in the new selected one (such as field or some settings).
              It the future would be nice to have the same behavior but it's hard without a proper definition,
              as Elasticsearch will error sometimes if some settings are not compatible.
            */
            return {
                id: bucketAgg.id,
                type: action.payload.newType,
                settings: bucketAggregationConfig[action.payload.newType].defaultSettings,
            };
        });
    }
    if (changeBucketAggregationField.match(action)) {
        return state.map(function (bucketAgg) {
            if (bucketAgg.id !== action.payload.id) {
                return bucketAgg;
            }
            return __assign(__assign({}, bucketAgg), { field: action.payload.newField });
        });
    }
    if (changeMetricType.match(action)) {
        // If we are switching to a metric which requires the absence of bucket aggregations
        // we remove all of them.
        if (metricAggregationConfig[action.payload.type].isSingleMetric) {
            return [];
        }
        else if (state.length === 0) {
            // Else, if there are no bucket aggregations we restore a default one.
            // This happens when switching from a metric that requires the absence of bucket aggregations to
            // one that requires it.
            return [__assign(__assign({}, defaultBucketAgg('2')), { field: defaultTimeField })];
        }
        return state;
    }
    if (changeBucketAggregationSetting.match(action)) {
        return state.map(function (bucketAgg) {
            var _a;
            if (bucketAgg.id !== action.payload.bucketAgg.id) {
                return bucketAgg;
            }
            var newSettings = removeEmpty(__assign(__assign({}, bucketAgg.settings), (_a = {}, _a[action.payload.settingName] = action.payload.newValue, _a)));
            return __assign(__assign({}, bucketAgg), { settings: __assign({}, newSettings) });
        });
    }
    if (initQuery.match(action)) {
        if ((state === null || state === void 0 ? void 0 : state.length) || 0 > 0) {
            return state;
        }
        return [__assign(__assign({}, defaultBucketAgg('2')), { field: defaultTimeField })];
    }
    return state;
}; };
//# sourceMappingURL=reducer.js.map
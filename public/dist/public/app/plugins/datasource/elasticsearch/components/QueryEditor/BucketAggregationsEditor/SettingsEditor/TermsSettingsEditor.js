import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { InlineField, Select, Input } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { inlineFieldProps } from '.';
import { bucketAggregationConfig, orderByOptions, orderOptions, sizeOptions } from '../utils';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
import { changeBucketAggregationSetting } from '../state/actions';
import { useQuery } from '../../ElasticsearchQueryContext';
import { describeMetric } from '../../../../utils';
import { isPipelineAggregation, } from '../../MetricAggregationsEditor/aggregations';
import { uniqueId } from 'lodash';
export var TermsSettingsEditor = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var bucketAgg = _a.bucketAgg;
    var metrics = useQuery().metrics;
    var orderBy = createOrderByOptions(metrics);
    var dispatch = useDispatch();
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, __assign({ label: "Order" }, inlineFieldProps),
            React.createElement(Select, { menuShouldPortal: true, onChange: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'order', newValue: e.value }));
                }, options: orderOptions, value: ((_b = bucketAgg.settings) === null || _b === void 0 ? void 0 : _b.order) || ((_c = bucketAggregationConfig.terms.defaultSettings) === null || _c === void 0 ? void 0 : _c.order) })),
        React.createElement(InlineField, __assign({ label: "Size" }, inlineFieldProps),
            React.createElement(Select, __assign({ menuShouldPortal: true }, useCreatableSelectPersistedBehaviour({
                options: sizeOptions,
                value: ((_d = bucketAgg.settings) === null || _d === void 0 ? void 0 : _d.size) || ((_e = bucketAggregationConfig.terms.defaultSettings) === null || _e === void 0 ? void 0 : _e.size),
                onChange: function (_a) {
                    var value = _a.value;
                    dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'size', newValue: value }));
                },
            })))),
        React.createElement(InlineField, __assign({ label: "Min Doc Count" }, inlineFieldProps),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'min_doc_count', newValue: e.target.value }));
                }, defaultValue: ((_f = bucketAgg.settings) === null || _f === void 0 ? void 0 : _f.min_doc_count) || ((_g = bucketAggregationConfig.terms.defaultSettings) === null || _g === void 0 ? void 0 : _g.min_doc_count) })),
        React.createElement(InlineField, __assign({ label: "Order By" }, inlineFieldProps),
            React.createElement(Select, { inputId: uniqueId('es-terms-'), menuShouldPortal: true, onChange: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'orderBy', newValue: e.value }));
                }, options: orderBy, value: ((_h = bucketAgg.settings) === null || _h === void 0 ? void 0 : _h.orderBy) || ((_j = bucketAggregationConfig.terms.defaultSettings) === null || _j === void 0 ? void 0 : _j.orderBy) })),
        React.createElement(InlineField, __assign({ label: "Missing" }, inlineFieldProps),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'missing', newValue: e.target.value }));
                }, defaultValue: ((_k = bucketAgg.settings) === null || _k === void 0 ? void 0 : _k.missing) || ((_l = bucketAggregationConfig.terms.defaultSettings) === null || _l === void 0 ? void 0 : _l.missing) }))));
};
/**
 * This returns the valid options for each of the enabled extended stat
 */
function createOrderByOptionsForExtendedStats(metric) {
    if (!metric.meta) {
        return [];
    }
    var metaKeys = Object.keys(metric.meta);
    return metaKeys
        .filter(function (key) { var _a; return (_a = metric.meta) === null || _a === void 0 ? void 0 : _a[key]; })
        .map(function (key) {
        var method = key;
        // The bucket path for std_deviation_bounds.lower and std_deviation_bounds.upper
        // is accessed via std_lower and std_upper, respectively.
        if (key === 'std_deviation_bounds_lower') {
            method = 'std_lower';
        }
        if (key === 'std_deviation_bounds_upper') {
            method = 'std_upper';
        }
        return { label: describeMetric(metric) + " (" + method + ")", value: metric.id + "[" + method + "]" };
    });
}
/**
 * This returns the valid options for each of the percents listed in the percentile settings
 */
function createOrderByOptionsForPercentiles(metric) {
    var _a;
    if (!((_a = metric.settings) === null || _a === void 0 ? void 0 : _a.percents)) {
        return [];
    }
    return metric.settings.percents.map(function (percent) {
        // The bucket path for percentile numbers is appended with a `.0` if the number is whole
        // otherwise you have to use the actual value.
        var percentString = /^\d+\.\d+/.test("" + percent) ? percent : percent + ".0";
        return { label: describeMetric(metric) + " (" + percent + ")", value: metric.id + "[" + percentString + "]" };
    });
}
function isValidOrderTarget(metric) {
    return (
    // top metrics can't be used for ordering
    metric.type !== 'top_metrics' &&
        // pipeline aggregations can't be used for ordering: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-order
        !isPipelineAggregation(metric));
}
/**
 * This creates all the valid order by options based on the metrics
 */
export var createOrderByOptions = function (metrics) {
    if (metrics === void 0) { metrics = []; }
    var metricOptions = metrics.filter(isValidOrderTarget).flatMap(function (metric) {
        if (metric.type === 'extended_stats') {
            return createOrderByOptionsForExtendedStats(metric);
        }
        else if (metric.type === 'percentiles') {
            return createOrderByOptionsForPercentiles(metric);
        }
        else {
            return { label: describeMetric(metric), value: metric.id };
        }
    });
    return __spreadArray(__spreadArray([], __read(orderByOptions), false), __read(metricOptions), false);
};
//# sourceMappingURL=TermsSettingsEditor.js.map
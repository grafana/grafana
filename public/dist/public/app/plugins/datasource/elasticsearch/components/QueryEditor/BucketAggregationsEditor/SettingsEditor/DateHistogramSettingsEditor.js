import { __assign } from "tslib";
import React from 'react';
import { InlineField, Input, Select } from '@grafana/ui';
import { bucketAggregationConfig } from '../utils';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeBucketAggregationSetting } from '../state/actions';
import { inlineFieldProps } from '.';
import { uniqueId } from 'lodash';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
var defaultIntervalOptions = [
    { label: 'auto', value: 'auto' },
    { label: '10s', value: '10s' },
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '20m', value: '20m' },
    { label: '1h', value: '1h' },
    { label: '1d', value: '1d' },
];
var hasValue = function (searchValue) { return function (_a) {
    var value = _a.value;
    return value === searchValue;
}; };
var isValidNewOption = function (inputValue, _, options) {
    // TODO: would be extremely nice here to allow only template variables and values that are
    // valid date histogram's Interval options
    var valueExists = options.some(hasValue(inputValue));
    // we also don't want users to create "empty" values
    return !valueExists && inputValue.trim().length > 0;
};
var optionStartsWithValue = function (option, value) { var _a; return ((_a = option.value) === null || _a === void 0 ? void 0 : _a.startsWith(value)) || false; };
export var DateHistogramSettingsEditor = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var bucketAgg = _a.bucketAgg;
    var dispatch = useDispatch();
    var handleIntervalChange = function (_a) {
        var value = _a.value;
        return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'interval', newValue: value }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, __assign({ label: "Interval" }, inlineFieldProps),
            React.createElement(Select, __assign({ menuShouldPortal: true, inputId: uniqueId('es-date_histogram-interval'), isValidNewOption: isValidNewOption, filterOption: optionStartsWithValue }, useCreatableSelectPersistedBehaviour({
                options: defaultIntervalOptions,
                value: ((_b = bucketAgg.settings) === null || _b === void 0 ? void 0 : _b.interval) || ((_c = bucketAggregationConfig.date_histogram.defaultSettings) === null || _c === void 0 ? void 0 : _c.interval),
                onChange: handleIntervalChange,
            })))),
        React.createElement(InlineField, __assign({ label: "Min Doc Count" }, inlineFieldProps),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'min_doc_count', newValue: e.target.value }));
                }, defaultValue: ((_d = bucketAgg.settings) === null || _d === void 0 ? void 0 : _d.min_doc_count) || ((_e = bucketAggregationConfig.date_histogram.defaultSettings) === null || _e === void 0 ? void 0 : _e.min_doc_count) })),
        React.createElement(InlineField, __assign({ label: "Trim Edges" }, inlineFieldProps, { tooltip: "Trim the edges on the timeseries datapoints" }),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'trimEdges', newValue: e.target.value }));
                }, defaultValue: ((_f = bucketAgg.settings) === null || _f === void 0 ? void 0 : _f.trimEdges) || ((_g = bucketAggregationConfig.date_histogram.defaultSettings) === null || _g === void 0 ? void 0 : _g.trimEdges) })),
        React.createElement(InlineField, __assign({ label: "Offset" }, inlineFieldProps, { tooltip: "Change the start value of each bucket by the specified positive (+) or negative offset (-) duration, such as 1h for an hour, or 1d for a day" }),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'offset', newValue: e.target.value }));
                }, defaultValue: ((_h = bucketAgg.settings) === null || _h === void 0 ? void 0 : _h.offset) || ((_j = bucketAggregationConfig.date_histogram.defaultSettings) === null || _j === void 0 ? void 0 : _j.offset) }))));
};
//# sourceMappingURL=DateHistogramSettingsEditor.js.map
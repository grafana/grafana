import { __assign, __read } from "tslib";
import { InlineField, Input, InlineSwitch, Select } from '@grafana/ui';
import React, { useState } from 'react';
import { extendedStats } from '../../../../query_def';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeMetricMeta, changeMetricSetting } from '../state/actions';
import { isMetricAggregationWithInlineScript, isMetricAggregationWithMissingSupport, } from '../aggregations';
import { BucketScriptSettingsEditor } from './BucketScriptSettingsEditor';
import { SettingField } from './SettingField';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { useDescription } from './useDescription';
import { MovingAverageSettingsEditor } from './MovingAverageSettingsEditor';
import { TopMetricsSettingsEditor } from './TopMetricsSettingsEditor';
import { uniqueId } from 'lodash';
import { metricAggregationConfig } from '../utils';
import { useQuery } from '../../ElasticsearchQueryContext';
// TODO: Move this somewhere and share it with BucketsAggregation Editor
var inlineFieldProps = {
    labelWidth: 16,
};
export var SettingsEditor = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h;
    var metric = _a.metric, previousMetrics = _a.previousMetrics;
    var dispatch = useDispatch();
    var description = useDescription(metric);
    var query = useQuery();
    var rateAggUnitOptions = [
        { value: 'second', label: 'Second' },
        { value: 'minute', label: 'Minute' },
        { value: 'hour', label: 'Hour' },
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
        { value: 'quarter', label: 'Quarter' },
        { value: 'Year', label: 'Year' },
    ];
    var rateAggModeOptions = [
        { value: 'sum', label: 'Sum' },
        { value: 'value_count', label: 'Value count' },
    ];
    return (React.createElement(SettingsEditorContainer, { label: description, hidden: metric.hide },
        metric.type === 'derivative' && React.createElement(SettingField, { label: "Unit", metric: metric, settingName: "unit" }),
        metric.type === 'serial_diff' && React.createElement(SettingField, { label: "Lag", metric: metric, settingName: "lag", placeholder: "1" }),
        metric.type === 'cumulative_sum' && React.createElement(SettingField, { label: "Format", metric: metric, settingName: "format" }),
        metric.type === 'moving_avg' && React.createElement(MovingAverageSettingsEditor, { metric: metric }),
        metric.type === 'moving_fn' && (React.createElement(React.Fragment, null,
            React.createElement(SettingField, { label: "Window", metric: metric, settingName: "window" }),
            React.createElement(SettingField, { label: "Script", metric: metric, settingName: "script" }),
            React.createElement(SettingField, { label: "Shift", metric: metric, settingName: "shift" }))),
        metric.type === 'top_metrics' && React.createElement(TopMetricsSettingsEditor, { metric: metric }),
        metric.type === 'bucket_script' && (React.createElement(BucketScriptSettingsEditor, { value: metric, previousMetrics: previousMetrics })),
        (metric.type === 'raw_data' || metric.type === 'raw_document') && (React.createElement(InlineField, __assign({ label: "Size" }, inlineFieldProps),
            React.createElement(Input, { id: "ES-query-" + query.refId + "_metric-" + metric.id + "-size", onBlur: function (e) { return dispatch(changeMetricSetting({ metric: metric, settingName: 'size', newValue: e.target.value })); }, defaultValue: (_c = (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.size) !== null && _c !== void 0 ? _c : (_d = metricAggregationConfig['raw_data'].defaults.settings) === null || _d === void 0 ? void 0 : _d.size }))),
        metric.type === 'logs' && React.createElement(SettingField, { label: "Limit", metric: metric, settingName: "limit", placeholder: "500" }),
        metric.type === 'cardinality' && (React.createElement(SettingField, { label: "Precision Threshold", metric: metric, settingName: "precision_threshold" })),
        metric.type === 'extended_stats' && (React.createElement(React.Fragment, null,
            extendedStats.map(function (stat) {
                var _a, _b, _c;
                return (React.createElement(ExtendedStatSetting, { key: stat.value, stat: stat, onChange: function (newValue) { return dispatch(changeMetricMeta({ metric: metric, meta: stat.value, newValue: newValue })); }, value: ((_a = metric.meta) === null || _a === void 0 ? void 0 : _a[stat.value]) !== undefined
                        ? !!((_b = metric.meta) === null || _b === void 0 ? void 0 : _b[stat.value])
                        : !!((_c = metricAggregationConfig['extended_stats'].defaults.meta) === null || _c === void 0 ? void 0 : _c[stat.value]) }));
            }),
            React.createElement(SettingField, { label: "Sigma", metric: metric, settingName: "sigma", placeholder: "3" }))),
        metric.type === 'percentiles' && (React.createElement(InlineField, __assign({ label: "Percentiles" }, inlineFieldProps),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeMetricSetting({
                        metric: metric,
                        settingName: 'percents',
                        newValue: e.target.value.split(',').filter(Boolean),
                    }));
                }, defaultValue: ((_e = metric.settings) === null || _e === void 0 ? void 0 : _e.percents) || ((_f = metricAggregationConfig['percentiles'].defaults.settings) === null || _f === void 0 ? void 0 : _f.percents), placeholder: "1,5,25,50,75,95,99" }))),
        metric.type === 'rate' && (React.createElement(React.Fragment, null,
            React.createElement(InlineField, __assign({ label: "Unit" }, inlineFieldProps, { "data-testid": "unit-select" }),
                React.createElement(Select, { menuShouldPortal: true, id: "ES-query-" + query.refId + "_metric-" + metric.id + "-unit", onChange: function (e) { return dispatch(changeMetricSetting({ metric: metric, settingName: 'unit', newValue: e.value })); }, options: rateAggUnitOptions, value: (_g = metric.settings) === null || _g === void 0 ? void 0 : _g.unit })),
            React.createElement(InlineField, __assign({ label: "Mode" }, inlineFieldProps, { "data-testid": "mode-select" }),
                React.createElement(Select, { menuShouldPortal: true, id: "ES-query-" + query.refId + "_metric-" + metric.id + "-mode", onChange: function (e) { return dispatch(changeMetricSetting({ metric: metric, settingName: 'mode', newValue: e.value })); }, options: rateAggModeOptions, value: (_h = metric.settings) === null || _h === void 0 ? void 0 : _h.unit })))),
        isMetricAggregationWithInlineScript(metric) && (React.createElement(SettingField, { label: "Script", metric: metric, settingName: "script", placeholder: "_value * 1" })),
        isMetricAggregationWithMissingSupport(metric) && (React.createElement(SettingField, { label: "Missing", metric: metric, settingName: "missing", tooltip: "The missing parameter defines how documents that are missing a value should be treated. By default\n            they will be ignored but it is also possible to treat them as if they had a value" }))));
};
var ExtendedStatSetting = function (_a) {
    var stat = _a.stat, onChange = _a.onChange, value = _a.value;
    // this is needed for the htmlFor prop in the label so that clicking the label will toggle the switch state.
    var _b = __read(useState(uniqueId("es-field-id-")), 1), id = _b[0];
    return (React.createElement(InlineField, __assign({ label: stat.label }, inlineFieldProps, { key: stat.value }),
        React.createElement(InlineSwitch, { id: id, onChange: function (e) { return onChange(e.target.checked); }, value: value })));
};
//# sourceMappingURL=index.js.map
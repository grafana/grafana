import { uniqueId } from 'lodash';
import React, { useId, useRef, useState } from 'react';
import { InlineField, Input, InlineSwitch, Select } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { extendedStats } from '../../../../queryDef';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { isMetricAggregationWithInlineScript, isMetricAggregationWithMissingSupport } from '../aggregations';
import { changeMetricMeta, changeMetricSetting } from '../state/actions';
import { metricAggregationConfig } from '../utils';
import { BucketScriptSettingsEditor } from './BucketScriptSettingsEditor';
import { MovingAverageSettingsEditor } from './MovingAverageSettingsEditor';
import { SettingField } from './SettingField';
import { TopMetricsSettingsEditor } from './TopMetricsSettingsEditor';
import { useDescription } from './useDescription';
// TODO: Move this somewhere and share it with BucketsAggregation Editor
const inlineFieldProps = {
    labelWidth: 16,
};
export const SettingsEditor = ({ metric, previousMetrics }) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const { current: baseId } = useRef(uniqueId('es-setting-'));
    const dispatch = useDispatch();
    const description = useDescription(metric);
    const sizeFieldId = useId();
    const unitFieldId = useId();
    const modeFieldId = useId();
    const rateAggUnitOptions = [
        { value: 'second', label: 'Second' },
        { value: 'minute', label: 'Minute' },
        { value: 'hour', label: 'Hour' },
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
        { value: 'quarter', label: 'Quarter' },
        { value: 'Year', label: 'Year' },
    ];
    const rateAggModeOptions = [
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
        (metric.type === 'raw_data' || metric.type === 'raw_document') && (React.createElement(InlineField, Object.assign({ label: "Size" }, inlineFieldProps, { htmlFor: sizeFieldId }),
            React.createElement(Input, { id: sizeFieldId, onBlur: (e) => dispatch(changeMetricSetting({ metric, settingName: 'size', newValue: e.target.value })), defaultValue: (_b = (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : (_c = metricAggregationConfig['raw_data'].defaults.settings) === null || _c === void 0 ? void 0 : _c.size }))),
        metric.type === 'logs' && React.createElement(SettingField, { label: "Limit", metric: metric, settingName: "limit", placeholder: "500" }),
        metric.type === 'cardinality' && (React.createElement(SettingField, { label: "Precision Threshold", metric: metric, settingName: "precision_threshold" })),
        metric.type === 'extended_stats' && (React.createElement(React.Fragment, null,
            extendedStats.map((stat) => {
                var _a, _b, _c;
                return (React.createElement(ExtendedStatSetting, { key: stat.value, stat: stat, onChange: (newValue) => dispatch(changeMetricMeta({ metric, meta: stat.value, newValue })), value: ((_a = metric.meta) === null || _a === void 0 ? void 0 : _a[stat.value]) !== undefined
                        ? !!((_b = metric.meta) === null || _b === void 0 ? void 0 : _b[stat.value])
                        : !!((_c = metricAggregationConfig['extended_stats'].defaults.meta) === null || _c === void 0 ? void 0 : _c[stat.value]) }));
            }),
            React.createElement(SettingField, { label: "Sigma", metric: metric, settingName: "sigma", placeholder: "3" }))),
        metric.type === 'percentiles' && (React.createElement(InlineField, Object.assign({ label: "Percentiles" }, inlineFieldProps),
            React.createElement(Input, { id: `${baseId}-percentiles-percents`, onBlur: (e) => dispatch(changeMetricSetting({
                    metric,
                    settingName: 'percents',
                    newValue: e.target.value.split(',').filter(Boolean),
                })), defaultValue: ((_d = metric.settings) === null || _d === void 0 ? void 0 : _d.percents) || ((_e = metricAggregationConfig['percentiles'].defaults.settings) === null || _e === void 0 ? void 0 : _e.percents), placeholder: "1,5,25,50,75,95,99" }))),
        metric.type === 'rate' && (React.createElement(React.Fragment, null,
            React.createElement(InlineField, Object.assign({ label: "Unit" }, inlineFieldProps, { "data-testid": "unit-select", htmlFor: unitFieldId }),
                React.createElement(Select, { id: unitFieldId, onChange: (e) => dispatch(changeMetricSetting({ metric, settingName: 'unit', newValue: e.value })), options: rateAggUnitOptions, value: (_f = metric.settings) === null || _f === void 0 ? void 0 : _f.unit })),
            React.createElement(InlineField, Object.assign({ label: "Mode" }, inlineFieldProps, { "data-testid": "mode-select", htmlFor: modeFieldId }),
                React.createElement(Select, { id: modeFieldId, onChange: (e) => dispatch(changeMetricSetting({ metric, settingName: 'mode', newValue: e.value })), options: rateAggModeOptions, value: (_g = metric.settings) === null || _g === void 0 ? void 0 : _g.unit })))),
        isMetricAggregationWithInlineScript(metric) && (React.createElement(SettingField, { label: "Script", metric: metric, settingName: "script", placeholder: "_value * 1" })),
        isMetricAggregationWithMissingSupport(metric) && (React.createElement(SettingField, { label: "Missing", metric: metric, settingName: "missing", tooltip: "The missing parameter defines how documents that are missing a value should be treated. By default\n            they will be ignored but it is also possible to treat them as if they had a value" }))));
};
const ExtendedStatSetting = ({ stat, onChange, value }) => {
    // this is needed for the htmlFor prop in the label so that clicking the label will toggle the switch state.
    const [id] = useState(uniqueId(`es-field-id-`));
    return (React.createElement(InlineField, Object.assign({ label: stat.label }, inlineFieldProps, { key: stat.value }),
        React.createElement(InlineSwitch, { id: id, onChange: (e) => onChange(e.target.checked), value: value })));
};
//# sourceMappingURL=index.js.map
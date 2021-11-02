import { __assign } from "tslib";
import { Input, InlineField, Select, InlineSwitch } from '@grafana/ui';
import React from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { movingAvgModelOptions } from '../../../../query_def';
import { isEWMAMovingAverage, isHoltMovingAverage, isHoltWintersMovingAverage } from '../aggregations';
import { changeMetricSetting } from '../state/actions';
import { SettingField } from './SettingField';
// The way we handle changes for those settings is not ideal compared to the other components in the editor
// FIXME: using `changeMetricSetting` will cause an error when switching from models that have different options
// as they might be incompatible. We should clear all other options on model change.
export var MovingAverageSettingsEditor = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var metric = _a.metric;
    var dispatch = useDispatch();
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Model", labelWidth: 16 },
            React.createElement(Select, { menuShouldPortal: true, onChange: function (value) { return dispatch(changeMetricSetting({ metric: metric, settingName: 'model', newValue: value.value })); }, options: movingAvgModelOptions, value: (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.model })),
        React.createElement(SettingField, { label: "Window", settingName: "window", metric: metric, placeholder: "5" }),
        React.createElement(SettingField, { label: "Predict", settingName: "predict", metric: metric }),
        (isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (React.createElement(InlineField, { label: "Alpha", labelWidth: 16 },
            React.createElement(Input, { onBlur: function (e) {
                    var _a;
                    return dispatch(changeMetricSetting({
                        metric: metric,
                        settingName: 'settings',
                        newValue: __assign(__assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { alpha: e.target.value }),
                    }));
                }, defaultValue: (_d = (_c = metric.settings) === null || _c === void 0 ? void 0 : _c.settings) === null || _d === void 0 ? void 0 : _d.alpha }))),
        (isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (React.createElement(InlineField, { label: "Beta", labelWidth: 16 },
            React.createElement(Input, { onBlur: function (e) {
                    var _a;
                    return dispatch(changeMetricSetting({
                        metric: metric,
                        settingName: 'settings',
                        newValue: __assign(__assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { beta: e.target.value }),
                    }));
                }, defaultValue: (_f = (_e = metric.settings) === null || _e === void 0 ? void 0 : _e.settings) === null || _f === void 0 ? void 0 : _f.beta }))),
        isHoltWintersMovingAverage(metric) && (React.createElement(React.Fragment, null,
            React.createElement(InlineField, { label: "Gamma", labelWidth: 16 },
                React.createElement(Input, { onBlur: function (e) {
                        var _a;
                        return dispatch(changeMetricSetting({
                            metric: metric,
                            settingName: 'settings',
                            newValue: __assign(__assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { gamma: e.target.value }),
                        }));
                    }, defaultValue: (_h = (_g = metric.settings) === null || _g === void 0 ? void 0 : _g.settings) === null || _h === void 0 ? void 0 : _h.gamma })),
            React.createElement(InlineField, { label: "Period", labelWidth: 16 },
                React.createElement(Input, { onBlur: function (e) {
                        var _a;
                        return dispatch(changeMetricSetting({
                            metric: metric,
                            settingName: 'settings',
                            newValue: __assign(__assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { period: e.target.value }),
                        }));
                    }, defaultValue: (_k = (_j = metric.settings) === null || _j === void 0 ? void 0 : _j.settings) === null || _k === void 0 ? void 0 : _k.period })),
            React.createElement(InlineField, { label: "Pad", labelWidth: 16 },
                React.createElement(InlineSwitch, { onChange: function (e) {
                        var _a;
                        return dispatch(changeMetricSetting({
                            metric: metric,
                            settingName: 'settings',
                            newValue: __assign(__assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { pad: e.target.checked }),
                        }));
                    }, checked: !!((_m = (_l = metric.settings) === null || _l === void 0 ? void 0 : _l.settings) === null || _m === void 0 ? void 0 : _m.pad) })))),
        (isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (React.createElement(InlineField, { label: "Minimize", labelWidth: 16 },
            React.createElement(InlineSwitch, { onChange: function (e) {
                    return dispatch(changeMetricSetting({ metric: metric, settingName: 'minimize', newValue: e.target.checked }));
                }, checked: !!((_o = metric.settings) === null || _o === void 0 ? void 0 : _o.minimize) })))));
};
//# sourceMappingURL=MovingAverageSettingsEditor.js.map
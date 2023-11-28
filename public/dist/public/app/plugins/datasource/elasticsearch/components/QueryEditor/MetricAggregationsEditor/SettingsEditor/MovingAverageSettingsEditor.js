import { uniqueId } from 'lodash';
import React, { useRef } from 'react';
import { Input, InlineField, Select, InlineSwitch } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { movingAvgModelOptions } from '../../../../queryDef';
import { isEWMAMovingAverage, isHoltMovingAverage, isHoltWintersMovingAverage } from '../aggregations';
import { changeMetricSetting } from '../state/actions';
import { SettingField } from './SettingField';
// The way we handle changes for those settings is not ideal compared to the other components in the editor
// FIXME: using `changeMetricSetting` will cause an error when switching from models that have different options
// as they might be incompatible. We should clear all other options on model change.
export const MovingAverageSettingsEditor = ({ metric }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const dispatch = useDispatch();
    const { current: baseId } = useRef(uniqueId('es-moving-avg-'));
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Model", labelWidth: 16 },
            React.createElement(Select, { inputId: `${baseId}-model`, onChange: (value) => dispatch(changeMetricSetting({ metric, settingName: 'model', newValue: value.value })), options: movingAvgModelOptions, value: (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.model })),
        React.createElement(SettingField, { label: "Window", settingName: "window", metric: metric, placeholder: "5" }),
        React.createElement(SettingField, { label: "Predict", settingName: "predict", metric: metric }),
        (isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (React.createElement(InlineField, { label: "Alpha", labelWidth: 16 },
            React.createElement(Input, { id: `${baseId}-alpha`, onBlur: (e) => {
                    var _a;
                    return dispatch(changeMetricSetting({
                        metric,
                        settingName: 'settings',
                        newValue: Object.assign(Object.assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { alpha: e.target.value }),
                    }));
                }, defaultValue: (_c = (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.settings) === null || _c === void 0 ? void 0 : _c.alpha }))),
        (isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (React.createElement(InlineField, { label: "Beta", labelWidth: 16 },
            React.createElement(Input, { id: `${baseId}-beta`, onBlur: (e) => {
                    var _a;
                    return dispatch(changeMetricSetting({
                        metric,
                        settingName: 'settings',
                        newValue: Object.assign(Object.assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { beta: e.target.value }),
                    }));
                }, defaultValue: (_e = (_d = metric.settings) === null || _d === void 0 ? void 0 : _d.settings) === null || _e === void 0 ? void 0 : _e.beta }))),
        isHoltWintersMovingAverage(metric) && (React.createElement(React.Fragment, null,
            React.createElement(InlineField, { label: "Gamma", labelWidth: 16 },
                React.createElement(Input, { id: `${baseId}-gamma`, onBlur: (e) => {
                        var _a;
                        return dispatch(changeMetricSetting({
                            metric,
                            settingName: 'settings',
                            newValue: Object.assign(Object.assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { gamma: e.target.value }),
                        }));
                    }, defaultValue: (_g = (_f = metric.settings) === null || _f === void 0 ? void 0 : _f.settings) === null || _g === void 0 ? void 0 : _g.gamma })),
            React.createElement(InlineField, { label: "Period", labelWidth: 16 },
                React.createElement(Input, { id: `${baseId}-period`, onBlur: (e) => {
                        var _a;
                        return dispatch(changeMetricSetting({
                            metric,
                            settingName: 'settings',
                            newValue: Object.assign(Object.assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { period: e.target.value }),
                        }));
                    }, defaultValue: (_j = (_h = metric.settings) === null || _h === void 0 ? void 0 : _h.settings) === null || _j === void 0 ? void 0 : _j.period })),
            React.createElement(InlineField, { label: "Pad", labelWidth: 16 },
                React.createElement(InlineSwitch, { id: `${baseId}-pad`, onChange: (e) => {
                        var _a;
                        return dispatch(changeMetricSetting({
                            metric,
                            settingName: 'settings',
                            newValue: Object.assign(Object.assign({}, (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.settings), { pad: e.target.checked }),
                        }));
                    }, checked: !!((_l = (_k = metric.settings) === null || _k === void 0 ? void 0 : _k.settings) === null || _l === void 0 ? void 0 : _l.pad) })))),
        (isEWMAMovingAverage(metric) || isHoltMovingAverage(metric) || isHoltWintersMovingAverage(metric)) && (React.createElement(InlineField, { label: "Minimize", labelWidth: 16 },
            React.createElement(InlineSwitch, { id: `${baseId}-minimize`, onChange: (e) => dispatch(changeMetricSetting({ metric, settingName: 'minimize', newValue: e.target.checked })), checked: !!((_m = metric.settings) === null || _m === void 0 ? void 0 : _m.minimize) })))));
};
//# sourceMappingURL=MovingAverageSettingsEditor.js.map
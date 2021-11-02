import { __makeTemplateObject } from "tslib";
import { AsyncMultiSelect, InlineField, SegmentAsync, Select } from '@grafana/ui';
import React from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { useFields } from '../../../../hooks/useFields';
import { changeMetricSetting } from '../state/actions';
import { orderOptions } from '../../BucketAggregationsEditor/utils';
import { css } from '@emotion/css';
var toMultiSelectValue = function (value) { return ({ value: value, label: value }); };
export var TopMetricsSettingsEditor = function (_a) {
    var _b, _c, _d, _e;
    var metric = _a.metric;
    var dispatch = useDispatch();
    var getOrderByOptions = useFields(['number', 'date']);
    var getMetricsOptions = useFields(metric.type);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Metrics", labelWidth: 16 },
            React.createElement(AsyncMultiSelect, { menuShouldPortal: true, onChange: function (e) {
                    return dispatch(changeMetricSetting({
                        metric: metric,
                        settingName: 'metrics',
                        newValue: e.map(function (v) { return v.value; }),
                    }));
                }, loadOptions: getMetricsOptions, value: (_c = (_b = metric.settings) === null || _b === void 0 ? void 0 : _b.metrics) === null || _c === void 0 ? void 0 : _c.map(toMultiSelectValue), closeMenuOnSelect: false, defaultOptions: true })),
        React.createElement(InlineField, { label: "Order", labelWidth: 16 },
            React.createElement(Select, { menuShouldPortal: true, onChange: function (e) { return dispatch(changeMetricSetting({ metric: metric, settingName: 'order', newValue: e.value })); }, options: orderOptions, value: (_d = metric.settings) === null || _d === void 0 ? void 0 : _d.order })),
        React.createElement(InlineField, { label: "Order By", labelWidth: 16, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          & > div {\n            width: 100%;\n          }\n        "], ["\n          & > div {\n            width: 100%;\n          }\n        "]))) },
            React.createElement(SegmentAsync, { className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            margin-right: 0;\n          "], ["\n            margin-right: 0;\n          "]))), loadOptions: getOrderByOptions, onChange: function (e) { return dispatch(changeMetricSetting({ metric: metric, settingName: 'orderBy', newValue: e.value })); }, placeholder: "Select Field", value: (_e = metric.settings) === null || _e === void 0 ? void 0 : _e.orderBy }))));
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=TopMetricsSettingsEditor.js.map
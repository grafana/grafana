import { css } from '@emotion/css';
import React from 'react';
import { AsyncMultiSelect, InlineField, SegmentAsync, Select } from '@grafana/ui';
import { useFields } from '../../../../hooks/useFields';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { orderOptions } from '../../BucketAggregationsEditor/utils';
import { changeMetricSetting } from '../state/actions';
const toMultiSelectValue = (value) => ({ value, label: value });
export const TopMetricsSettingsEditor = ({ metric }) => {
    var _a, _b, _c, _d;
    const dispatch = useDispatch();
    const getOrderByOptions = useFields(['number', 'date']);
    const getMetricsOptions = useFields(metric.type);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Metrics", labelWidth: 16 },
            React.createElement(AsyncMultiSelect, { onChange: (e) => dispatch(changeMetricSetting({
                    metric,
                    settingName: 'metrics',
                    newValue: e.map((v) => v.value),
                })), loadOptions: getMetricsOptions, value: (_b = (_a = metric.settings) === null || _a === void 0 ? void 0 : _a.metrics) === null || _b === void 0 ? void 0 : _b.map(toMultiSelectValue), closeMenuOnSelect: false, defaultOptions: true })),
        React.createElement(InlineField, { label: "Order", labelWidth: 16 },
            React.createElement(Select, { onChange: (e) => dispatch(changeMetricSetting({ metric, settingName: 'order', newValue: e.value })), options: orderOptions, value: (_c = metric.settings) === null || _c === void 0 ? void 0 : _c.order })),
        React.createElement(InlineField, { label: "Order By", labelWidth: 16, className: css `
          & > div {
            width: 100%;
          }
        ` },
            React.createElement(SegmentAsync, { className: css `
            margin-right: 0;
          `, loadOptions: getOrderByOptions, onChange: (e) => dispatch(changeMetricSetting({ metric, settingName: 'orderBy', newValue: e.value })), placeholder: "Select Field", value: (_d = metric.settings) === null || _d === void 0 ? void 0 : _d.orderBy }))));
};
//# sourceMappingURL=TopMetricsSettingsEditor.js.map
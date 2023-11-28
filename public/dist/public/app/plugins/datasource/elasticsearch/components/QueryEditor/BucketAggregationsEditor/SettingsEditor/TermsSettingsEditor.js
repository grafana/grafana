import { uniqueId } from 'lodash';
import React, { useRef } from 'react';
import { InlineField, Select, Input } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { describeMetric } from '../../../../utils';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
import { useQuery } from '../../ElasticsearchQueryContext';
import { isPipelineAggregation } from '../../MetricAggregationsEditor/aggregations';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig, orderByOptions, orderOptions, sizeOptions } from '../utils';
import { inlineFieldProps } from '.';
export const TermsSettingsEditor = ({ bucketAgg }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const { metrics } = useQuery();
    const orderBy = createOrderByOptions(metrics);
    const { current: baseId } = useRef(uniqueId('es-terms-'));
    const dispatch = useDispatch();
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, Object.assign({ label: "Order" }, inlineFieldProps),
            React.createElement(Select, { inputId: `${baseId}-order`, onChange: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'order', newValue: e.value })), options: orderOptions, value: ((_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.order) || ((_b = bucketAggregationConfig.terms.defaultSettings) === null || _b === void 0 ? void 0 : _b.order) })),
        React.createElement(InlineField, Object.assign({ label: "Size" }, inlineFieldProps),
            React.createElement(Select, Object.assign({ inputId: `${baseId}-size` }, useCreatableSelectPersistedBehaviour({
                options: sizeOptions,
                value: ((_c = bucketAgg.settings) === null || _c === void 0 ? void 0 : _c.size) || ((_d = bucketAggregationConfig.terms.defaultSettings) === null || _d === void 0 ? void 0 : _d.size),
                onChange({ value }) {
                    dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'size', newValue: value }));
                },
            })))),
        React.createElement(InlineField, Object.assign({ label: "Min Doc Count" }, inlineFieldProps),
            React.createElement(Input, { id: `${baseId}-min_doc_count`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value })), defaultValue: ((_e = bucketAgg.settings) === null || _e === void 0 ? void 0 : _e.min_doc_count) || ((_f = bucketAggregationConfig.terms.defaultSettings) === null || _f === void 0 ? void 0 : _f.min_doc_count) })),
        React.createElement(InlineField, Object.assign({ label: "Order By" }, inlineFieldProps),
            React.createElement(Select, { inputId: `${baseId}-order_by`, onChange: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'orderBy', newValue: e.value })), options: orderBy, value: ((_g = bucketAgg.settings) === null || _g === void 0 ? void 0 : _g.orderBy) || ((_h = bucketAggregationConfig.terms.defaultSettings) === null || _h === void 0 ? void 0 : _h.orderBy) })),
        React.createElement(InlineField, Object.assign({ label: "Missing" }, inlineFieldProps),
            React.createElement(Input, { id: `${baseId}-missing`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'missing', newValue: e.target.value })), defaultValue: ((_j = bucketAgg.settings) === null || _j === void 0 ? void 0 : _j.missing) || ((_k = bucketAggregationConfig.terms.defaultSettings) === null || _k === void 0 ? void 0 : _k.missing) }))));
};
/**
 * This returns the valid options for each of the enabled extended stat
 */
function createOrderByOptionsForExtendedStats(metric) {
    if (!metric.meta) {
        return [];
    }
    const metaKeys = Object.keys(metric.meta);
    return metaKeys
        .filter((key) => { var _a; return (_a = metric.meta) === null || _a === void 0 ? void 0 : _a[key]; })
        .map((key) => {
        let method = key;
        // The bucket path for std_deviation_bounds.lower and std_deviation_bounds.upper
        // is accessed via std_lower and std_upper, respectively.
        if (key === 'std_deviation_bounds_lower') {
            method = 'std_lower';
        }
        if (key === 'std_deviation_bounds_upper') {
            method = 'std_upper';
        }
        return { label: `${describeMetric(metric)} (${method})`, value: `${metric.id}[${method}]` };
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
    return metric.settings.percents.map((percent) => {
        // The bucket path for percentile numbers is appended with a `.0` if the number is whole
        // otherwise you have to use the actual value.
        const percentString = /^\d+\.\d+/.test(`${percent}`) ? percent : `${percent}.0`;
        return { label: `${describeMetric(metric)} (${percent})`, value: `${metric.id}[${percentString}]` };
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
export const createOrderByOptions = (metrics = []) => {
    const metricOptions = metrics.filter(isValidOrderTarget).flatMap((metric) => {
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
    return [...orderByOptions, ...metricOptions];
};
//# sourceMappingURL=TermsSettingsEditor.js.map
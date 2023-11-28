import { uniqueId } from 'lodash';
import React, { useRef } from 'react';
import { InternalTimeZones } from '@grafana/data';
import { InlineField, Input, Select, TimeZonePicker } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig } from '../utils';
import { inlineFieldProps } from '.';
const defaultIntervalOptions = [
    { label: 'auto', value: 'auto' },
    { label: '10s', value: '10s' },
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '20m', value: '20m' },
    { label: '1h', value: '1h' },
    { label: '1d', value: '1d' },
];
const hasValue = (searchValue) => ({ value }) => value === searchValue;
const isValidNewOption = (inputValue, _, options) => {
    // TODO: would be extremely nice here to allow only template variables and values that are
    // valid date histogram's Interval options
    const valueExists = options.some(hasValue(inputValue));
    // we also don't want users to create "empty" values
    return !valueExists && inputValue.trim().length > 0;
};
const optionStartsWithValue = (option, value) => { var _a; return ((_a = option.value) === null || _a === void 0 ? void 0 : _a.startsWith(value)) || false; };
export const DateHistogramSettingsEditor = ({ bucketAgg }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const dispatch = useDispatch();
    const { current: baseId } = useRef(uniqueId('es-date_histogram-'));
    const handleIntervalChange = ({ value }) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'interval', newValue: value }));
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, Object.assign({ label: "Interval" }, inlineFieldProps),
            React.createElement(Select, Object.assign({ inputId: uniqueId('es-date_histogram-interval'), isValidNewOption: isValidNewOption, filterOption: optionStartsWithValue }, useCreatableSelectPersistedBehaviour({
                options: defaultIntervalOptions,
                value: ((_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.interval) || ((_b = bucketAggregationConfig.date_histogram.defaultSettings) === null || _b === void 0 ? void 0 : _b.interval),
                onChange: handleIntervalChange,
            })))),
        React.createElement(InlineField, Object.assign({ label: "Min Doc Count" }, inlineFieldProps),
            React.createElement(Input, { id: `${baseId}-min_doc_count`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value })), defaultValue: ((_c = bucketAgg.settings) === null || _c === void 0 ? void 0 : _c.min_doc_count) || ((_d = bucketAggregationConfig.date_histogram.defaultSettings) === null || _d === void 0 ? void 0 : _d.min_doc_count) })),
        React.createElement(InlineField, Object.assign({ label: "Trim Edges" }, inlineFieldProps, { tooltip: "Trim the edges on the timeseries datapoints" }),
            React.createElement(Input, { id: `${baseId}-trime_edges`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'trimEdges', newValue: e.target.value })), defaultValue: ((_e = bucketAgg.settings) === null || _e === void 0 ? void 0 : _e.trimEdges) || ((_f = bucketAggregationConfig.date_histogram.defaultSettings) === null || _f === void 0 ? void 0 : _f.trimEdges) })),
        React.createElement(InlineField, Object.assign({ label: "Offset" }, inlineFieldProps, { tooltip: "Change the start value of each bucket by the specified positive (+) or negative offset (-) duration, such as 1h for an hour, or 1d for a day" }),
            React.createElement(Input, { id: `${baseId}-offset`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'offset', newValue: e.target.value })), defaultValue: ((_g = bucketAgg.settings) === null || _g === void 0 ? void 0 : _g.offset) || ((_h = bucketAggregationConfig.date_histogram.defaultSettings) === null || _h === void 0 ? void 0 : _h.offset) })),
        React.createElement(InlineField, Object.assign({ label: "Timezone" }, inlineFieldProps),
            React.createElement(TimeZonePicker, { value: ((_j = bucketAgg.settings) === null || _j === void 0 ? void 0 : _j.timeZone) || ((_k = bucketAggregationConfig.date_histogram.defaultSettings) === null || _k === void 0 ? void 0 : _k.timeZone), includeInternal: [InternalTimeZones.utc], onChange: (timeZone) => {
                    dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'timeZone', newValue: timeZone }));
                } }))));
};
//# sourceMappingURL=DateHistogramSettingsEditor.js.map
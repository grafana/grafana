import { uniqueId } from 'lodash';
import React, { useRef } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig } from '../utils';
import { DateHistogramSettingsEditor } from './DateHistogramSettingsEditor';
import { FiltersSettingsEditor } from './FiltersSettingsEditor';
import { TermsSettingsEditor } from './TermsSettingsEditor';
import { useDescription } from './useDescription';
export const inlineFieldProps = {
    labelWidth: 16,
};
export const SettingsEditor = ({ bucketAgg }) => {
    var _a, _b, _c, _d, _e, _f;
    const { current: baseId } = useRef(uniqueId('es-setting-'));
    const dispatch = useDispatch();
    const settingsDescription = useDescription(bucketAgg);
    return (React.createElement(SettingsEditorContainer, { label: settingsDescription },
        bucketAgg.type === 'terms' && React.createElement(TermsSettingsEditor, { bucketAgg: bucketAgg }),
        bucketAgg.type === 'date_histogram' && React.createElement(DateHistogramSettingsEditor, { bucketAgg: bucketAgg }),
        bucketAgg.type === 'filters' && React.createElement(FiltersSettingsEditor, { bucketAgg: bucketAgg }),
        bucketAgg.type === 'geohash_grid' && (React.createElement(InlineField, Object.assign({ label: "Precision" }, inlineFieldProps),
            React.createElement(Input, { id: `${baseId}-geohash_grid-precision`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'precision', newValue: e.target.value })), defaultValue: ((_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.precision) || ((_b = bucketAggregationConfig[bucketAgg.type].defaultSettings) === null || _b === void 0 ? void 0 : _b.precision) }))),
        bucketAgg.type === 'histogram' && (React.createElement(React.Fragment, null,
            React.createElement(InlineField, Object.assign({ label: "Interval" }, inlineFieldProps),
                React.createElement(Input, { id: `${baseId}-histogram-interval`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'interval', newValue: e.target.value })), defaultValue: ((_c = bucketAgg.settings) === null || _c === void 0 ? void 0 : _c.interval) || ((_d = bucketAggregationConfig[bucketAgg.type].defaultSettings) === null || _d === void 0 ? void 0 : _d.interval) })),
            React.createElement(InlineField, Object.assign({ label: "Min Doc Count" }, inlineFieldProps),
                React.createElement(Input, { id: `${baseId}-histogram-min_doc_count`, onBlur: (e) => dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value })), defaultValue: ((_e = bucketAgg.settings) === null || _e === void 0 ? void 0 : _e.min_doc_count) ||
                        ((_f = bucketAggregationConfig[bucketAgg.type].defaultSettings) === null || _f === void 0 ? void 0 : _f.min_doc_count) }))))));
};
//# sourceMappingURL=index.js.map
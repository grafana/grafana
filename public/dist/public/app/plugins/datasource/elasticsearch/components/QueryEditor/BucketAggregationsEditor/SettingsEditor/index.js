import { __assign } from "tslib";
import { InlineField, Input } from '@grafana/ui';
import React from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig } from '../utils';
import { FiltersSettingsEditor } from './FiltersSettingsEditor';
import { useDescription } from './useDescription';
import { DateHistogramSettingsEditor } from './DateHistogramSettingsEditor';
import { TermsSettingsEditor } from './TermsSettingsEditor';
export var inlineFieldProps = {
    labelWidth: 16,
};
export var SettingsEditor = function (_a) {
    var _b, _c, _d, _e, _f, _g;
    var bucketAgg = _a.bucketAgg;
    var dispatch = useDispatch();
    var settingsDescription = useDescription(bucketAgg);
    return (React.createElement(SettingsEditorContainer, { label: settingsDescription },
        bucketAgg.type === 'terms' && React.createElement(TermsSettingsEditor, { bucketAgg: bucketAgg }),
        bucketAgg.type === 'date_histogram' && React.createElement(DateHistogramSettingsEditor, { bucketAgg: bucketAgg }),
        bucketAgg.type === 'filters' && React.createElement(FiltersSettingsEditor, { bucketAgg: bucketAgg }),
        bucketAgg.type === 'geohash_grid' && (React.createElement(InlineField, __assign({ label: "Precision" }, inlineFieldProps),
            React.createElement(Input, { onBlur: function (e) {
                    return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'precision', newValue: e.target.value }));
                }, defaultValue: ((_b = bucketAgg.settings) === null || _b === void 0 ? void 0 : _b.precision) || ((_c = bucketAggregationConfig[bucketAgg.type].defaultSettings) === null || _c === void 0 ? void 0 : _c.precision) }))),
        bucketAgg.type === 'histogram' && (React.createElement(React.Fragment, null,
            React.createElement(InlineField, __assign({ label: "Interval" }, inlineFieldProps),
                React.createElement(Input, { onBlur: function (e) {
                        return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'interval', newValue: e.target.value }));
                    }, defaultValue: ((_d = bucketAgg.settings) === null || _d === void 0 ? void 0 : _d.interval) || ((_e = bucketAggregationConfig[bucketAgg.type].defaultSettings) === null || _e === void 0 ? void 0 : _e.interval) })),
            React.createElement(InlineField, __assign({ label: "Min Doc Count" }, inlineFieldProps),
                React.createElement(Input, { onBlur: function (e) {
                        return dispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'min_doc_count', newValue: e.target.value }));
                    }, defaultValue: ((_f = bucketAgg.settings) === null || _f === void 0 ? void 0 : _f.min_doc_count) ||
                        ((_g = bucketAggregationConfig[bucketAgg.type].defaultSettings) === null || _g === void 0 ? void 0 : _g.min_doc_count) }))))));
};
//# sourceMappingURL=index.js.map
import { __read } from "tslib";
import { InlineSegmentGroup, Segment, SegmentAsync } from '@grafana/ui';
import React from 'react';
import { useFields } from '../../../hooks/useFields';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { segmentStyles } from '../styles';
import { isBucketAggregationWithField } from './aggregations';
import { SettingsEditor } from './SettingsEditor';
import { changeBucketAggregationField, changeBucketAggregationType } from './state/actions';
import { bucketAggregationConfig } from './utils';
var bucketAggOptions = Object.entries(bucketAggregationConfig).map(function (_a) {
    var _b = __read(_a, 2), key = _b[0], label = _b[1].label;
    return ({
        label: label,
        value: key,
    });
});
var toOption = function (bucketAgg) { return ({
    label: bucketAggregationConfig[bucketAgg.type].label,
    value: bucketAgg.type,
}); };
export var BucketAggregationEditor = function (_a) {
    var value = _a.value;
    var dispatch = useDispatch();
    var getFields = useFields(value.type);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(Segment, { className: segmentStyles, options: bucketAggOptions, onChange: function (e) { return dispatch(changeBucketAggregationType({ id: value.id, newType: e.value })); }, value: toOption(value) }),
            isBucketAggregationWithField(value) && (React.createElement(SegmentAsync, { className: segmentStyles, loadOptions: getFields, onChange: function (e) { return dispatch(changeBucketAggregationField({ id: value.id, newField: e.value })); }, placeholder: "Select Field", value: value.field }))),
        React.createElement(SettingsEditor, { bucketAgg: value })));
};
//# sourceMappingURL=BucketAggregationEditor.js.map
import React from 'react';
import { InlineSegmentGroup, Segment, SegmentAsync } from '@grafana/ui';
import { useFields } from '../../../hooks/useFields';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { segmentStyles } from '../styles';
import { SettingsEditor } from './SettingsEditor';
import { isBucketAggregationWithField } from './aggregations';
import { changeBucketAggregationField, changeBucketAggregationType } from './state/actions';
import { bucketAggregationConfig } from './utils';
const bucketAggOptions = Object.entries(bucketAggregationConfig).map(([key, { label }]) => ({
    label,
    value: key,
}));
const toOption = (bucketAgg) => ({
    label: bucketAggregationConfig[bucketAgg.type].label,
    value: bucketAgg.type,
});
export const BucketAggregationEditor = ({ value }) => {
    const dispatch = useDispatch();
    const getFields = useFields(value.type);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(Segment, { className: segmentStyles, options: bucketAggOptions, onChange: (e) => dispatch(changeBucketAggregationType({ id: value.id, newType: e.value })), value: toOption(value) }),
            isBucketAggregationWithField(value) && (React.createElement(SegmentAsync, { className: segmentStyles, loadOptions: getFields, onChange: (e) => dispatch(changeBucketAggregationField({ id: value.id, newField: e.value })), placeholder: "Select Field", value: value.field }))),
        React.createElement(SettingsEditor, { bucketAgg: value })));
};
//# sourceMappingURL=BucketAggregationEditor.js.map
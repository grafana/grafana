import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { InlineField, InlineFieldRow, LoadingPlaceholder, Select } from '@grafana/ui';
import { ProfileTypesCascader, useProfileTypes } from './QueryEditor/ProfileTypesCascader';
export function VariableQueryEditor(props) {
    var _a, _b;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query type", labelWidth: 20, tooltip: React.createElement("div", null, "The Prometheus data source plugin provides the following query types for template variables") },
                React.createElement(Select, { placeholder: "Select query type", "aria-label": "Query type", width: 25, options: [
                        { label: 'Profile type', value: 'profileType' },
                        { label: 'Label', value: 'label' },
                        { label: 'Label value', value: 'labelValue' },
                    ], onChange: (value) => {
                        if (value.value === 'profileType') {
                            props.onChange(Object.assign(Object.assign({}, props.query), { type: value.value }));
                        }
                        if (value.value === 'label') {
                            props.onChange(Object.assign(Object.assign({}, props.query), { type: value.value, profileTypeId: '' }));
                        }
                        if (value.value === 'labelValue') {
                            props.onChange(Object.assign(Object.assign({}, props.query), { type: value.value, profileTypeId: '', labelName: '' }));
                        }
                    }, value: props.query.type }))),
        (props.query.type === 'labelValue' || props.query.type === 'label') && (React.createElement(ProfileTypeRow, { datasource: props.datasource, initialValue: props.query.profileTypeId, onChange: (val) => {
                // To make TS happy
                if (props.query.type === 'label' || props.query.type === 'labelValue') {
                    props.onChange(Object.assign(Object.assign({}, props.query), { profileTypeId: val }));
                }
            } })),
        props.query.type === 'labelValue' && (React.createElement(LabelRow, { value: props.query.labelName, datasource: props.datasource, profileTypeId: props.query.profileTypeId, onChange: (val) => {
                if (props.query.type === 'labelValue') {
                    props.onChange(Object.assign(Object.assign({}, props.query), { labelName: val }));
                }
            }, from: ((_a = props.range) === null || _a === void 0 ? void 0 : _a.from.valueOf()) || Date.now().valueOf() - 1000 * 60 * 60 * 24, to: ((_b = props.range) === null || _b === void 0 ? void 0 : _b.to.valueOf()) || Date.now().valueOf() }))));
}
function LabelRow(props) {
    const [labels, setLabels] = useState();
    useEffect(() => {
        (() => __awaiter(this, void 0, void 0, function* () {
            setLabels(yield props.datasource.getLabelNames((props.profileTypeId || '') + '{}', props.from, props.to));
        }))();
    }, [props.datasource, props.profileTypeId, props.to, props.from]);
    const options = labels ? labels.map((v) => ({ label: v, value: v })) : [];
    if (labels && props.value && !labels.find((v) => v === props.value)) {
        options.push({ value: props.value, label: props.value });
    }
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: 'Label', labelWidth: 20, tooltip: React.createElement("div", null, "Select label for which to retrieve available values") },
            React.createElement(Select, { allowCustomValue: true, placeholder: "Select label", "aria-label": "Select label", width: 25, options: options, onChange: (option) => props.onChange(option.value), value: props.value }))));
}
function ProfileTypeRow(props) {
    const profileTypes = useProfileTypes(props.datasource);
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: 'Profile type', "aria-label": 'Profile type', labelWidth: 20, tooltip: React.createElement("div", null, "Select profile type for which to retrieve available labels") }, profileTypes ? (React.createElement(ProfileTypesCascader, { onChange: props.onChange, profileTypes: profileTypes, initialProfileTypeId: props.initialValue })) : (React.createElement(LoadingPlaceholder, { text: 'Loading' })))));
}
//# sourceMappingURL=VariableQueryEditor.js.map
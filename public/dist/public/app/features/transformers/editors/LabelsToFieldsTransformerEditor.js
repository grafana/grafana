import { __rest } from "tslib";
import React, { useMemo } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { LabelsToFieldsMode, } from '@grafana/data/src/transformations/transformers/labelsToFields';
import { Stack } from '@grafana/experimental';
import { InlineField, InlineFieldRow, RadioButtonGroup, Select, FilterPill } from '@grafana/ui';
const modes = [
    { value: LabelsToFieldsMode.Columns, label: 'Columns' },
    { value: LabelsToFieldsMode.Rows, label: 'Rows' },
];
export const LabelsAsFieldsTransformerEditor = ({ input, options, onChange, }) => {
    var _a;
    const labelWidth = 20;
    const { labelNames, selected } = useMemo(() => {
        var _a;
        let labelNames = [];
        let uniqueLabels = {};
        for (const frame of input) {
            for (const field of frame.fields) {
                if (!field.labels) {
                    continue;
                }
                for (const labelName of Object.keys(field.labels)) {
                    if (!uniqueLabels[labelName]) {
                        labelNames.push({ value: labelName, label: labelName });
                        uniqueLabels[labelName] = true;
                    }
                }
            }
        }
        const selected = new Set(((_a = options.keepLabels) === null || _a === void 0 ? void 0 : _a.length) ? options.keepLabels : Object.keys(uniqueLabels));
        return { labelNames, selected };
    }, [options.keepLabels, input]);
    const onValueLabelChange = (value) => {
        onChange(Object.assign(Object.assign({}, options), { valueLabel: value === null || value === void 0 ? void 0 : value.value }));
    };
    const onToggleSelection = (v) => {
        if (selected.has(v)) {
            selected.delete(v);
        }
        else {
            selected.add(v);
        }
        if (selected.size === labelNames.length || !selected.size) {
            const { keepLabels } = options, rest = __rest(options, ["keepLabels"]);
            onChange(rest);
        }
        else {
            onChange(Object.assign(Object.assign({}, options), { keepLabels: [...selected] }));
        }
    };
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Mode', labelWidth: labelWidth },
                React.createElement(RadioButtonGroup, { options: modes, value: (_a = options.mode) !== null && _a !== void 0 ? _a : LabelsToFieldsMode.Columns, onChange: (v) => onChange(Object.assign(Object.assign({}, options), { mode: v })) }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Labels', labelWidth: labelWidth },
                React.createElement(Stack, { gap: 1, wrap: true }, labelNames.map((o, i) => {
                    const label = o.label;
                    return (React.createElement(FilterPill, { key: `${label}/${i}`, onClick: () => onToggleSelection(label), label: label, selected: selected.has(label) }));
                })))),
        options.mode !== LabelsToFieldsMode.Rows && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Value field name', labelWidth: labelWidth, tooltip: "Replace the value field name with a label", htmlFor: "labels-to-fields-as-name" },
                React.createElement(Select, { inputId: "labels-to-fields-as-name", isClearable: true, allowCustomValue: false, placeholder: "(Optional) Select label", options: labelNames, value: options === null || options === void 0 ? void 0 : options.valueLabel, onChange: onValueLabelChange, className: "min-width-16" }))))));
};
export const labelsToFieldsTransformerRegistryItem = {
    id: DataTransformerID.labelsToFields,
    editor: LabelsAsFieldsTransformerEditor,
    transformation: standardTransformers.labelsToFieldsTransformer,
    name: 'Labels to fields',
    description: `Groups series by time and return labels or tags as fields.
                Useful for showing time series with labels in a table where each label key becomes a separate column.`,
    categories: new Set([TransformerCategory.Reformat]),
};
//# sourceMappingURL=LabelsToFieldsTransformerEditor.js.map
import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { ReduceTransformerMode } from '@grafana/data/src/transformations/transformers/reduce';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, Select, StatsPicker, InlineSwitch } from '@grafana/ui';
// TODO:  Minimal implementation, needs some <3
export const ReduceTransformerEditor = ({ options, onChange }) => {
    const modes = [
        {
            label: 'Series to rows',
            value: ReduceTransformerMode.SeriesToRows,
            description: 'Create a table with one row for each series value',
        },
        {
            label: 'Reduce fields',
            value: ReduceTransformerMode.ReduceFields,
            description: 'Collapse each field into a single value',
        },
    ];
    const onSelectMode = useCallback((value) => {
        const mode = value.value;
        onChange(Object.assign(Object.assign({}, options), { mode, includeTimeField: mode === ReduceTransformerMode.ReduceFields ? !!options.includeTimeField : false }));
    }, [onChange, options]);
    const onToggleTime = useCallback(() => {
        onChange(Object.assign(Object.assign({}, options), { includeTimeField: !options.includeTimeField }));
    }, [onChange, options]);
    const onToggleLabels = useCallback(() => {
        onChange(Object.assign(Object.assign({}, options), { labelsToFields: !options.labelsToFields }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Mode", "aria-label": selectors.components.Transforms.Reduce.modeLabel, grow: true, labelWidth: 16 },
            React.createElement(Select, { options: modes, value: modes.find((v) => v.value === options.mode) || modes[0], onChange: onSelectMode })),
        React.createElement(InlineField, { label: "Calculations", "aria-label": selectors.components.Transforms.Reduce.calculationsLabel, grow: true, labelWidth: 16 },
            React.createElement(StatsPicker, { placeholder: "Choose Stat", allowMultiple: true, stats: options.reducers || [], onChange: (stats) => {
                    onChange(Object.assign(Object.assign({}, options), { reducers: stats }));
                } })),
        options.mode === ReduceTransformerMode.ReduceFields && (React.createElement(InlineField, { htmlFor: "include-time-field", labelWidth: 16, label: "Include time" },
            React.createElement(InlineSwitch, { id: "include-time-field", value: !!options.includeTimeField, onChange: onToggleTime }))),
        options.mode !== ReduceTransformerMode.ReduceFields && (React.createElement(InlineField, { htmlFor: "labels-to-fields", labelWidth: 16, label: "Labels to fields" },
            React.createElement(InlineSwitch, { id: "labels-to-fields", value: !!options.labelsToFields, onChange: onToggleLabels })))));
};
export const reduceTransformRegistryItem = {
    id: DataTransformerID.reduce,
    editor: ReduceTransformerEditor,
    transformation: standardTransformers.reduceTransformer,
    name: standardTransformers.reduceTransformer.name,
    description: standardTransformers.reduceTransformer.description,
    categories: new Set([TransformerCategory.CalculateNewFields]),
};
//# sourceMappingURL=ReduceTransformerEditor.js.map
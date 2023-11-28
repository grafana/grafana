import React, { useCallback, useMemo } from 'react';
import { DataTransformerID, PluginState, TransformerCategory, } from '@grafana/data';
import { InlineField, InlineFieldRow, ValuePicker, Button, HorizontalGroup, FieldValidationMessage, RadioButtonGroup, } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { partitionByValuesTransformer } from './partitionByValues';
export function PartitionByValuesEditor({ input, options, onChange, }) {
    var _a;
    const names = useFieldDisplayNames(input);
    const allSelectOptions = useSelectOptions(names);
    const selectOptions = useMemo(() => {
        const fieldNames = new Set(options.fields);
        if (fieldNames.size < 1) {
            return allSelectOptions;
        }
        return allSelectOptions.filter((v) => !fieldNames.has(v.value));
    }, [allSelectOptions, options]);
    const addField = useCallback((v) => {
        if (!v.value) {
            return;
        }
        const fieldNames = new Set(options.fields);
        fieldNames.add(v.value);
        onChange(Object.assign(Object.assign({}, options), { fields: [...fieldNames] }));
    }, [onChange, options]);
    let namingModes;
    (function (namingModes) {
        namingModes[namingModes["asLabels"] = 0] = "asLabels";
        namingModes[namingModes["frameName"] = 1] = "frameName";
    })(namingModes || (namingModes = {}));
    const namingModesOptions = [
        { label: 'As label', value: namingModes.asLabels },
        { label: 'As frame name', value: namingModes.frameName },
    ];
    const removeField = useCallback((v) => {
        if (!v) {
            return;
        }
        const fieldNames = new Set(options.fields);
        fieldNames.delete(v);
        onChange(Object.assign(Object.assign({}, options), { fields: [...fieldNames] }));
    }, [onChange, options]);
    if (input.length > 1) {
        return React.createElement(FieldValidationMessage, null, "Partition by values only works with a single frame.");
    }
    const fieldNames = [...new Set(options.fields)];
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Field", labelWidth: 10, grow: true },
                React.createElement(HorizontalGroup, null,
                    fieldNames.map((name) => (React.createElement(Button, { key: name, icon: "times", variant: "secondary", size: "md", onClick: () => removeField(name) }, name))),
                    selectOptions.length && (React.createElement(ValuePicker, { variant: "secondary", size: "md", options: selectOptions, onChange: addField, label: "Select field", icon: "plus" }))))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { tooltip: 'Sets how the names of the selected fields are displayed. As frame name is usually better for tabular data', label: 'Naming', labelWidth: 10 },
                React.createElement(RadioButtonGroup, { options: namingModesOptions, value: ((_a = options.naming) === null || _a === void 0 ? void 0 : _a.asLabels) === undefined || options.naming.asLabels
                        ? namingModes.asLabels
                        : namingModes.frameName, onChange: (v) => onChange(Object.assign(Object.assign({}, options), { naming: Object.assign(Object.assign({}, options.naming), { asLabels: v === namingModes.asLabels }) })) })))));
}
export const partitionByValuesTransformRegistryItem = {
    id: DataTransformerID.partitionByValues,
    editor: PartitionByValuesEditor,
    transformation: partitionByValuesTransformer,
    name: partitionByValuesTransformer.name,
    description: partitionByValuesTransformer.description,
    state: PluginState.alpha,
    categories: new Set([TransformerCategory.Reformat]),
};
//# sourceMappingURL=PartitionByValuesEditor.js.map
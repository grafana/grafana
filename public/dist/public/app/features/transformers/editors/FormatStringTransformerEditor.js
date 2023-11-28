import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, PluginState, FieldType, TransformerCategory, } from '@grafana/data';
import { FormatStringOutput, } from '@grafana/data/src/transformations/transformers/formatString';
import { Select, InlineFieldRow, InlineField } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
const fieldNamePickerSettings = {
    settings: {
        width: 30,
        filter: (f) => f.type === FieldType.string,
        placeholderText: 'Select text field',
        noFieldsMessage: 'No text fields found',
    },
    name: '',
    id: '',
    editor: () => null,
};
function FormatStringTransfomerEditor({ input, options, onChange, }) {
    var _a, _b, _c;
    const onSelectField = useCallback((value) => {
        const val = value !== null && value !== void 0 ? value : '';
        onChange(Object.assign(Object.assign({}, options), { stringField: val }));
    }, [onChange, options]);
    const onFormatChange = useCallback((value) => {
        var _a;
        const val = (_a = value.value) !== null && _a !== void 0 ? _a : FormatStringOutput.UpperCase;
        onChange(Object.assign(Object.assign({}, options), { outputFormat: val }));
    }, [onChange, options]);
    const onSubstringStartChange = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { substringStart: value !== null && value !== void 0 ? value : 0 }));
    }, [onChange, options]);
    const onSubstringEndChange = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { substringEnd: value !== null && value !== void 0 ? value : 0 }));
    }, [onChange, options]);
    const ops = Object.values(FormatStringOutput).map((value) => ({ label: value, value }));
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Field', labelWidth: 10 },
                React.createElement(FieldNamePicker, { context: { data: input }, value: (_a = options.stringField) !== null && _a !== void 0 ? _a : '', onChange: onSelectField, item: fieldNamePickerSettings })),
            React.createElement(InlineField, { label: "Format", labelWidth: 10 },
                React.createElement(Select, { options: ops, value: options.outputFormat, onChange: onFormatChange, width: 20 }))),
        options.outputFormat === FormatStringOutput.Substring && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Substring range", labelWidth: 15 },
                React.createElement(NumberInput, { min: 0, value: (_b = options.substringStart) !== null && _b !== void 0 ? _b : 0, onChange: onSubstringStartChange, width: 7 })),
            React.createElement(InlineField, null,
                React.createElement(NumberInput, { min: 0, value: (_c = options.substringEnd) !== null && _c !== void 0 ? _c : 0, onChange: onSubstringEndChange, width: 7 }))))));
}
export const formatStringTransformerRegistryItem = {
    id: DataTransformerID.formatString,
    editor: FormatStringTransfomerEditor,
    transformation: standardTransformers.formatStringTransformer,
    name: standardTransformers.formatStringTransformer.name,
    state: PluginState.beta,
    description: standardTransformers.formatStringTransformer.description,
    categories: new Set([TransformerCategory.Reformat]),
};
//# sourceMappingURL=FormatStringTransformerEditor.js.map
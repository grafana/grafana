import React from 'react';
import { DataTransformerID, TransformerCategory, } from '@grafana/data';
import { InlineField, InlineFieldRow, Select, InlineSwitch } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { JSONPathEditor } from './components/JSONPathEditor';
import { extractFieldsTransformer } from './extractFields';
import { fieldExtractors } from './fieldExtractors';
const fieldNamePickerSettings = {
    settings: {
        width: 30,
        placeholderText: 'Select field',
    },
    name: '',
    id: '',
    editor: () => null,
};
export const extractFieldsTransformerEditor = ({ input, options, onChange, }) => {
    var _a, _b, _c, _d;
    const onPickSourceField = (source) => {
        onChange(Object.assign(Object.assign({}, options), { source }));
    };
    const onFormatChange = (format) => {
        onChange(Object.assign(Object.assign({}, options), { format: format === null || format === void 0 ? void 0 : format.value }));
    };
    const onJSONPathsChange = (jsonPaths) => {
        onChange(Object.assign(Object.assign({}, options), { jsonPaths }));
    };
    const onToggleReplace = () => {
        if (options.replace) {
            options.keepTime = false;
        }
        onChange(Object.assign(Object.assign({}, options), { replace: !options.replace }));
    };
    const onToggleKeepTime = () => {
        onChange(Object.assign(Object.assign({}, options), { keepTime: !options.keepTime }));
    };
    const format = fieldExtractors.selectOptions(options.format ? [options.format] : undefined);
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Source', labelWidth: 16 },
                React.createElement(FieldNamePicker, { context: { data: input }, value: (_a = options.source) !== null && _a !== void 0 ? _a : '', onChange: onPickSourceField, item: fieldNamePickerSettings }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Format', labelWidth: 16 },
                React.createElement(Select, { value: format.current[0], options: format.options, onChange: onFormatChange, width: 24, placeholder: 'Auto' }))),
        options.format === 'json' && React.createElement(JSONPathEditor, { options: (_b = options.jsonPaths) !== null && _b !== void 0 ? _b : [], onChange: onJSONPathsChange }),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Replace all fields', labelWidth: 16 },
                React.createElement(InlineSwitch, { value: (_c = options.replace) !== null && _c !== void 0 ? _c : false, onChange: onToggleReplace }))),
        options.replace && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Keep time', labelWidth: 16 },
                React.createElement(InlineSwitch, { value: (_d = options.keepTime) !== null && _d !== void 0 ? _d : false, onChange: onToggleKeepTime }))))));
};
export const extractFieldsTransformRegistryItem = {
    id: DataTransformerID.extractFields,
    editor: extractFieldsTransformerEditor,
    transformation: extractFieldsTransformer,
    name: 'Extract fields',
    description: `Parse fields from content (JSON, labels, etc).`,
    categories: new Set([TransformerCategory.Reformat]),
};
//# sourceMappingURL=ExtractFieldsTransformerEditor.js.map
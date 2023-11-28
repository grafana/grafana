import React, { useCallback } from 'react';
import { TextDimensionMode } from '@grafana/schema';
import { Button, InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';
const textOptions = [
    { label: 'Fixed', value: TextDimensionMode.Fixed, description: 'Fixed value' },
    { label: 'Field', value: TextDimensionMode.Field, description: 'Display field value' },
    //  { label: 'Template', value: TextDimensionMode.Template, description: 'use template text' },
];
const dummyFieldSettings = {
    settings: {},
};
const dummyStringSettings = {
    settings: {},
};
export const TextDimensionEditor = ({ value, context, onChange }) => {
    var _a, _b;
    const labelWidth = 9;
    const onModeChange = useCallback((mode) => {
        onChange(Object.assign(Object.assign({}, value), { mode }));
    }, [onChange, value]);
    const onFieldChange = useCallback((field) => {
        onChange(Object.assign(Object.assign({}, value), { field }));
    }, [onChange, value]);
    const onFixedChange = useCallback((fixed = '') => {
        onChange(Object.assign(Object.assign({}, value), { fixed }));
    }, [onChange, value]);
    const onClearFixed = () => {
        onFixedChange('');
    };
    const mode = (_a = value === null || value === void 0 ? void 0 : value.mode) !== null && _a !== void 0 ? _a : TextDimensionMode.Fixed;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Source", labelWidth: labelWidth, grow: true },
                React.createElement(RadioButtonGroup, { value: mode, options: textOptions, onChange: onModeChange, fullWidth: true }))),
        mode !== TextDimensionMode.Fixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Field", labelWidth: labelWidth, grow: true },
                React.createElement(FieldNamePicker, { context: context, value: (_b = value.field) !== null && _b !== void 0 ? _b : '', onChange: onFieldChange, item: dummyFieldSettings })))),
        mode === TextDimensionMode.Fixed && (React.createElement(InlineFieldRow, { key: value === null || value === void 0 ? void 0 : value.fixed },
            React.createElement(InlineField, { label: 'Value', labelWidth: labelWidth, grow: true },
                React.createElement(StringValueEditor, { context: context, value: value === null || value === void 0 ? void 0 : value.fixed, onChange: onFixedChange, item: dummyStringSettings, suffix: (value === null || value === void 0 ? void 0 : value.fixed) && React.createElement(Button, { icon: "times", variant: "secondary", fill: "text", size: "sm", onClick: onClearFixed }) })))),
        mode === TextDimensionMode.Template && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Template", labelWidth: labelWidth, grow: true },
                React.createElement(StringValueEditor // This could be a code editor
                , { context: context, value: value === null || value === void 0 ? void 0 : value.fixed, onChange: onFixedChange, item: dummyStringSettings }))))));
};
//# sourceMappingURL=TextDimensionEditor.js.map
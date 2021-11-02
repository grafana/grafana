import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { TextDimensionMode } from '../types';
import { InlineField, InlineFieldRow, RadioButtonGroup, StringValueEditor } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';
var textOptions = [
    { label: 'Fixed', value: TextDimensionMode.Fixed, description: 'Fixed value' },
    { label: 'Field', value: TextDimensionMode.Field, description: 'Display field value' },
    //  { label: 'Template', value: TextDimensionMode.Template, description: 'use template text' },
];
var dummyFieldSettings = {
    settings: {},
};
var dummyStringSettings = {
    settings: {},
};
export var TextDimensionEditor = function (props) {
    var _a, _b;
    var value = props.value, context = props.context, onChange = props.onChange;
    var labelWidth = 9;
    var onModeChange = useCallback(function (mode) {
        onChange(__assign(__assign({}, value), { mode: mode }));
    }, [onChange, value]);
    var onFieldChange = useCallback(function (field) {
        onChange(__assign(__assign({}, value), { field: field }));
    }, [onChange, value]);
    var onFixedChange = useCallback(function (fixed) {
        onChange(__assign(__assign({}, value), { fixed: fixed }));
    }, [onChange, value]);
    var mode = (_a = value === null || value === void 0 ? void 0 : value.mode) !== null && _a !== void 0 ? _a : TextDimensionMode.Fixed;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Source", labelWidth: labelWidth, grow: true },
                React.createElement(RadioButtonGroup, { value: mode, options: textOptions, onChange: onModeChange, fullWidth: true }))),
        mode !== TextDimensionMode.Fixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Field", labelWidth: labelWidth, grow: true },
                React.createElement(FieldNamePicker, { context: context, value: (_b = value.field) !== null && _b !== void 0 ? _b : '', onChange: onFieldChange, item: dummyFieldSettings })))),
        mode === TextDimensionMode.Fixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Value', labelWidth: labelWidth, grow: true },
                React.createElement(StringValueEditor, { context: context, value: value === null || value === void 0 ? void 0 : value.fixed, onChange: onFixedChange, item: dummyStringSettings })))),
        mode === TextDimensionMode.Template && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Template", labelWidth: labelWidth, grow: true },
                React.createElement(StringValueEditor // This could be a code editor
                , { context: context, value: value === null || value === void 0 ? void 0 : value.fixed, onChange: onFixedChange, item: dummyStringSettings }))))));
};
//# sourceMappingURL=TextDimensionEditor.js.map
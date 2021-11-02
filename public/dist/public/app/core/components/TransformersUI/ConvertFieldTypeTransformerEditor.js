import { __assign, __read, __spreadArray } from "tslib";
import React, { useCallback } from 'react';
import { DataTransformerID, FieldType, standardTransformers, } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';
var fieldNamePickerSettings = {
    settings: { width: 24 },
};
export var ConvertFieldTypeTransformerEditor = function (_a) {
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var allTypes = [
        { value: FieldType.number, label: 'Numeric' },
        { value: FieldType.string, label: 'String' },
        { value: FieldType.time, label: 'Time' },
        { value: FieldType.boolean, label: 'Boolean' },
    ];
    var onSelectField = useCallback(function (idx) { return function (value) {
        var conversions = options.conversions;
        conversions[idx] = __assign(__assign({}, conversions[idx]), { targetField: value !== null && value !== void 0 ? value : '' });
        onChange(__assign(__assign({}, options), { conversions: conversions }));
    }; }, [onChange, options]);
    var onSelectDestinationType = useCallback(function (idx) { return function (value) {
        var conversions = options.conversions;
        conversions[idx] = __assign(__assign({}, conversions[idx]), { destinationType: value.value });
        onChange(__assign(__assign({}, options), { conversions: conversions }));
    }; }, [onChange, options]);
    var onInputFormat = useCallback(function (idx) { return function (e) {
        var conversions = options.conversions;
        conversions[idx] = __assign(__assign({}, conversions[idx]), { dateFormat: e.currentTarget.value });
        onChange(__assign(__assign({}, options), { conversions: conversions }));
    }; }, [onChange, options]);
    var onAddConvertFieldType = useCallback(function () {
        onChange(__assign(__assign({}, options), { conversions: __spreadArray(__spreadArray([], __read(options.conversions), false), [
                { targetField: undefined, destinationType: undefined, dateFormat: undefined },
            ], false) }));
    }, [onChange, options]);
    var onRemoveConvertFieldType = useCallback(function (idx) {
        var removed = options.conversions;
        removed.splice(idx, 1);
        onChange(__assign(__assign({}, options), { conversions: removed }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        options.conversions.map(function (c, idx) {
            var _a;
            return (React.createElement(InlineFieldRow, { key: c.targetField + "-" + idx },
                React.createElement(InlineField, { label: 'Field' },
                    React.createElement(FieldNamePicker, { context: { data: input }, value: (_a = c.targetField) !== null && _a !== void 0 ? _a : '', onChange: onSelectField(idx), item: fieldNamePickerSettings })),
                React.createElement(InlineField, { label: 'as' },
                    React.createElement(Select, { menuShouldPortal: true, options: allTypes, value: c.destinationType, placeholder: 'Type', onChange: onSelectDestinationType(idx), width: 18 })),
                c.destinationType === FieldType.time && (React.createElement(InlineField, { label: 'Date Format' },
                    React.createElement(Input, { value: c.dateFormat, placeholder: 'e.g. YYYY-MM-DD', onChange: onInputFormat(idx), width: 24 }))),
                React.createElement(Button, { size: "md", icon: "trash-alt", variant: "secondary", onClick: function () { return onRemoveConvertFieldType(idx); }, "aria-label": 'Remove convert field type transformer' })));
        }),
        React.createElement(Button, { size: "sm", icon: "plus", onClick: onAddConvertFieldType, variant: "secondary", "aria-label": 'Add a convert field type transformer' }, 'Convert field type')));
};
export var convertFieldTypeTransformRegistryItem = {
    id: DataTransformerID.convertFieldType,
    editor: ConvertFieldTypeTransformerEditor,
    transformation: standardTransformers.convertFieldTypeTransformer,
    name: standardTransformers.convertFieldTypeTransformer.name,
    description: standardTransformers.convertFieldTypeTransformer.description,
};
//# sourceMappingURL=ConvertFieldTypeTransformerEditor.js.map
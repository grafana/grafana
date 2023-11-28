import React, { useCallback } from 'react';
import { DataTransformerID, FieldType, standardTransformers, TransformerCategory, getTimeZones, } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { allFieldTypeIconOptions } from '@grafana/ui/src/components/MatchersUI/FieldTypeMatcherEditor';
import { hasAlphaPanels } from 'app/core/config';
import { findField } from 'app/features/dimensions';
import { getTimezoneOptions } from '../utils';
const fieldNamePickerSettings = {
    settings: { width: 24, isClearable: false },
};
export const ConvertFieldTypeTransformerEditor = ({ input, options, onChange, }) => {
    const allTypes = allFieldTypeIconOptions.filter((v) => v.value !== FieldType.trace);
    const timeZoneOptions = getTimezoneOptions(true);
    // Format timezone options
    const tzs = getTimeZones();
    timeZoneOptions.push({ label: 'Browser', value: 'browser' });
    timeZoneOptions.push({ label: 'UTC', value: 'utc' });
    for (const tz of tzs) {
        timeZoneOptions.push({ label: tz, value: tz });
    }
    const onSelectField = useCallback((idx) => (value) => {
        const conversions = options.conversions;
        conversions[idx] = Object.assign(Object.assign({}, conversions[idx]), { targetField: value !== null && value !== void 0 ? value : '', dateFormat: undefined });
        onChange(Object.assign(Object.assign({}, options), { conversions: conversions }));
    }, [onChange, options]);
    const onSelectDestinationType = useCallback((idx) => (value) => {
        const conversions = options.conversions;
        conversions[idx] = Object.assign(Object.assign({}, conversions[idx]), { destinationType: value.value });
        onChange(Object.assign(Object.assign({}, options), { conversions: conversions }));
    }, [onChange, options]);
    const onInputFormat = useCallback((idx) => (e) => {
        const conversions = options.conversions;
        conversions[idx] = Object.assign(Object.assign({}, conversions[idx]), { dateFormat: e.currentTarget.value });
        onChange(Object.assign(Object.assign({}, options), { conversions: conversions }));
    }, [onChange, options]);
    const onAddConvertFieldType = useCallback(() => {
        onChange(Object.assign(Object.assign({}, options), { conversions: [
                ...options.conversions,
                { targetField: undefined, destinationType: undefined, dateFormat: undefined },
            ] }));
    }, [onChange, options]);
    const onRemoveConvertFieldType = useCallback((idx) => {
        const removed = options.conversions;
        removed.splice(idx, 1);
        onChange(Object.assign(Object.assign({}, options), { conversions: removed }));
    }, [onChange, options]);
    const onTzChange = useCallback((idx) => (value) => {
        const conversions = options.conversions;
        conversions[idx] = Object.assign(Object.assign({}, conversions[idx]), { timezone: value === null || value === void 0 ? void 0 : value.value });
        onChange(Object.assign(Object.assign({}, options), { conversions: conversions }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        options.conversions.map((c, idx) => {
            var _a, _b;
            return (React.createElement("div", { key: `${c.targetField}-${idx}` },
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: 'Field' },
                        React.createElement(FieldNamePicker, { context: { data: input }, value: (_a = c.targetField) !== null && _a !== void 0 ? _a : '', onChange: onSelectField(idx), item: fieldNamePickerSettings })),
                    React.createElement(InlineField, { label: 'as' },
                        React.createElement(Select, { options: allTypes, value: c.destinationType, placeholder: 'Type', onChange: onSelectDestinationType(idx), width: 18 })),
                    c.destinationType === FieldType.time && (React.createElement(InlineField, { label: "Input format", tooltip: "Specify the format of the input field so Grafana can parse the date string correctly." },
                        React.createElement(Input, { value: c.dateFormat, placeholder: 'e.g. YYYY-MM-DD', onChange: onInputFormat(idx), width: 24 }))),
                    c.destinationType === FieldType.string &&
                        (c.dateFormat || ((_b = findField(input === null || input === void 0 ? void 0 : input[0], c.targetField)) === null || _b === void 0 ? void 0 : _b.type) === FieldType.time) && (React.createElement(React.Fragment, null,
                        React.createElement(InlineField, { label: "Date format", tooltip: "Specify the output format." },
                            React.createElement(Input, { value: c.dateFormat, placeholder: 'e.g. YYYY-MM-DD', onChange: onInputFormat(idx), width: 24 })),
                        React.createElement(InlineField, { label: "Set timezone", tooltip: "Set the timezone of the date manually" },
                            React.createElement(Select, { options: timeZoneOptions, value: c.timezone, onChange: onTzChange(idx), isClearable: true })))),
                    React.createElement(Button, { size: "md", icon: "trash-alt", variant: "secondary", onClick: () => onRemoveConvertFieldType(idx), "aria-label": 'Remove convert field type transformer' })),
                c.destinationType === FieldType.enum && hasAlphaPanels && (React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: '', labelWidth: 6 },
                        React.createElement("div", null, "TODO... show options here (alpha panels enabled)"))))));
        }),
        React.createElement(Button, { size: "sm", icon: "plus", onClick: onAddConvertFieldType, variant: "secondary", "aria-label": 'Add a convert field type transformer' }, 'Convert field type')));
};
export const convertFieldTypeTransformRegistryItem = {
    id: DataTransformerID.convertFieldType,
    editor: ConvertFieldTypeTransformerEditor,
    transformation: standardTransformers.convertFieldTypeTransformer,
    name: standardTransformers.convertFieldTypeTransformer.name,
    description: standardTransformers.convertFieldTypeTransformer.description,
    categories: new Set([TransformerCategory.Reformat]),
};
//# sourceMappingURL=ConvertFieldTypeTransformerEditor.js.map
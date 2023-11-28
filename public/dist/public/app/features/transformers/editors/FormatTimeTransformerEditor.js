import React, { useCallback } from 'react';
import { DataTransformerID, standardTransformers, getFieldDisplayName, PluginState, } from '@grafana/data';
import { Select, InlineFieldRow, InlineField, Input } from '@grafana/ui';
import { getTimezoneOptions } from '../utils';
export function FormatTimeTransfomerEditor({ input, options, onChange, }) {
    const timeFields = [];
    const timeZoneOptions = getTimezoneOptions(true);
    // Get time fields
    for (const frame of input) {
        for (const field of frame.fields) {
            if (field.type === 'time') {
                const name = getFieldDisplayName(field, frame, input);
                timeFields.push({ label: name, value: name });
            }
        }
    }
    const onSelectField = useCallback((value) => {
        const val = (value === null || value === void 0 ? void 0 : value.value) !== undefined ? value.value : '';
        onChange(Object.assign(Object.assign({}, options), { timeField: val }));
    }, [onChange, options]);
    const onFormatChange = useCallback((e) => {
        const val = e.target.value;
        onChange(Object.assign(Object.assign({}, options), { outputFormat: val }));
    }, [onChange, options]);
    const onTzChange = useCallback((value) => {
        const val = (value === null || value === void 0 ? void 0 : value.value) !== undefined ? value.value : '';
        onChange(Object.assign(Object.assign({}, options), { timezone: val }));
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Time Field", labelWidth: 15, grow: true },
                React.createElement(Select, { options: timeFields, value: options.timeField, onChange: onSelectField, placeholder: "time", isClearable: true })),
            React.createElement(InlineField, { label: "Format", labelWidth: 10, tooltip: React.createElement(React.Fragment, null,
                    "The output format for the field specified as a",
                    ' ',
                    React.createElement("a", { href: "https://momentjs.com/docs/#/displaying/", target: "_blank", rel: "noopener noreferrer" }, "Moment.js format string"),
                    "."), interactive: true },
                React.createElement(Input, { onChange: onFormatChange, value: options.outputFormat })),
            React.createElement(InlineField, { label: "Set Timezone", tooltip: "Set the timezone of the date manually", labelWidth: 20 },
                React.createElement(Select, { options: timeZoneOptions, value: options.timezone, onChange: onTzChange, isClearable: true })))));
}
export const formatTimeTransformerRegistryItem = {
    id: DataTransformerID.formatTime,
    editor: FormatTimeTransfomerEditor,
    transformation: standardTransformers.formatTimeTransformer,
    name: standardTransformers.formatTimeTransformer.name,
    state: PluginState.alpha,
    description: standardTransformers.formatTimeTransformer.description,
};
//# sourceMappingURL=FormatTimeTransformerEditor.js.map
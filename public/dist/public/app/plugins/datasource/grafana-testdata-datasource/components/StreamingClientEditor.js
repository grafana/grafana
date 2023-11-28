import React from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
const streamingClientFields = [
    { label: 'Speed (ms)', id: 'speed', placeholder: 'value', min: 10, step: 10 },
    { label: 'Spread', id: 'spread', placeholder: 'value', min: 0.5, step: 0.1 },
    { label: 'Noise', id: 'noise', placeholder: 'value', min: 0, step: 0.1 },
    { label: 'Bands', id: 'bands', placeholder: 'bands', min: 0, step: 1 },
];
const types = [
    { value: 'signal', label: 'Signal' },
    { value: 'logs', label: 'Logs' },
    { value: 'fetch', label: 'Fetch' },
];
export const StreamingClientEditor = ({ onChange, query }) => {
    var _a, _b, _c;
    const onSelectChange = ({ value }) => {
        onChange({ target: { name: 'type', value } });
    };
    // Convert values to numbers before saving
    const onInputChange = (e) => {
        const { name, value } = e.target;
        onChange({ target: { name, value: Number(value) } });
    };
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Type", labelWidth: 14 },
            React.createElement(Select, { width: 32, onChange: onSelectChange, defaultValue: types[0], options: types })),
        ((_a = query === null || query === void 0 ? void 0 : query.stream) === null || _a === void 0 ? void 0 : _a.type) === 'signal' &&
            streamingClientFields.map(({ label, id, min, step, placeholder }) => {
                var _a;
                return (React.createElement(InlineField, { label: label, labelWidth: 14, key: id },
                    React.createElement(Input, { width: 32, type: "number", id: `stream.${id}-${query.refId}`, name: id, min: min, step: step, value: (_a = query.stream) === null || _a === void 0 ? void 0 : _a[id], placeholder: placeholder, onChange: onInputChange })));
            }),
        ((_b = query === null || query === void 0 ? void 0 : query.stream) === null || _b === void 0 ? void 0 : _b.type) === 'fetch' && (React.createElement(InlineField, { label: "URL", labelWidth: 14, grow: true },
            React.createElement(Input, { type: "text", name: "url", id: `stream.url-${query.refId}`, value: (_c = query === null || query === void 0 ? void 0 : query.stream) === null || _c === void 0 ? void 0 : _c.url, placeholder: "Fetch URL", onChange: onChange })))));
};
//# sourceMappingURL=StreamingClientEditor.js.map
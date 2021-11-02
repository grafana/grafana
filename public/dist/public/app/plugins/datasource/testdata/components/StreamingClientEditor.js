import React from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
var streamingClientFields = [
    { label: 'Speed (ms)', id: 'speed', placeholder: 'value', min: 10, step: 10 },
    { label: 'Spread', id: 'spread', placeholder: 'value', min: 0.5, step: 0.1 },
    { label: 'Noise', id: 'noise', placeholder: 'value', min: 0, step: 0.1 },
    { label: 'Bands', id: 'bands', placeholder: 'bands', min: 0, step: 1 },
];
var types = [
    { value: 'signal', label: 'Signal' },
    { value: 'logs', label: 'Logs' },
    { value: 'fetch', label: 'Fetch' },
];
export var StreamingClientEditor = function (_a) {
    var _b, _c, _d;
    var onChange = _a.onChange, query = _a.query;
    var onSelectChange = function (_a) {
        var value = _a.value;
        onChange({ target: { name: 'type', value: value } });
    };
    // Convert values to numbers before saving
    var onInputChange = function (e) {
        var _a = e.target, name = _a.name, value = _a.value;
        onChange({ target: { name: name, value: Number(value) } });
    };
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Type", labelWidth: 14 },
            React.createElement(Select, { menuShouldPortal: true, width: 32, onChange: onSelectChange, defaultValue: types[0], options: types })),
        ((_b = query === null || query === void 0 ? void 0 : query.stream) === null || _b === void 0 ? void 0 : _b.type) === 'signal' &&
            streamingClientFields.map(function (_a) {
                var _b;
                var label = _a.label, id = _a.id, min = _a.min, step = _a.step, placeholder = _a.placeholder;
                return (React.createElement(InlineField, { label: label, labelWidth: 14, key: id },
                    React.createElement(Input, { width: 32, type: "number", id: "stream." + id + "-" + query.refId, name: id, min: min, step: step, value: (_b = query.stream) === null || _b === void 0 ? void 0 : _b[id], placeholder: placeholder, onChange: onInputChange })));
            }),
        ((_c = query === null || query === void 0 ? void 0 : query.stream) === null || _c === void 0 ? void 0 : _c.type) === 'fetch' && (React.createElement(InlineField, { label: "URL", labelWidth: 14, grow: true },
            React.createElement(Input, { type: "text", name: "url", id: "stream.url-" + query.refId, value: (_d = query === null || query === void 0 ? void 0 : query.stream) === null || _d === void 0 ? void 0 : _d.url, placeholder: "Fetch URL", onChange: onChange })))));
};
//# sourceMappingURL=StreamingClientEditor.js.map
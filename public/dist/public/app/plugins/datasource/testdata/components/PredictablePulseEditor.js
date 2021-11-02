import React from 'react';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
var fields = [
    { label: 'Step', id: 'timeStep', placeholder: '60', tooltip: 'The number of seconds between datapoints.' },
    {
        label: 'On Count',
        id: 'onCount',
        placeholder: '3',
        tooltip: 'The number of values within a cycle, at the start of the cycle, that should have the onValue.',
    },
    { label: 'Off Count', id: 'offCount', placeholder: '6', tooltip: 'The number of offValues within the cycle.' },
    {
        label: 'On Value',
        id: 'onValue',
        placeholder: '1',
        tooltip: 'The value for "on values", may be an int, float, or null.',
    },
    {
        label: 'Off Value',
        id: 'offValue',
        placeholder: '1',
        tooltip: 'The value for "off values", may be a int, float, or null.',
    },
];
export var PredictablePulseEditor = function (_a) {
    var onChange = _a.onChange, query = _a.query;
    // Convert values to numbers before saving
    var onInputChange = function (e) {
        var _a = e.target, name = _a.name, value = _a.value;
        onChange({ target: { name: name, value: Number(value) } });
    };
    return (React.createElement(InlineFieldRow, null, fields.map(function (_a) {
        var _b;
        var label = _a.label, id = _a.id, placeholder = _a.placeholder, tooltip = _a.tooltip;
        return (React.createElement(InlineField, { label: label, labelWidth: 14, key: id, tooltip: tooltip },
            React.createElement(Input, { width: 32, type: "number", name: id, id: "pulseWave." + id + "-" + query.refId, value: (_b = query.pulseWave) === null || _b === void 0 ? void 0 : _b[id], placeholder: placeholder, onChange: onInputChange })));
    })));
};
//# sourceMappingURL=PredictablePulseEditor.js.map
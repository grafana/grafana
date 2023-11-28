import React from 'react';
import { Input, InlineFieldRow, InlineField, Select } from '@grafana/ui';
export function NodeGraphEditor({ query, onChange }) {
    var _a, _b;
    const type = ((_a = query.nodes) === null || _a === void 0 ? void 0 : _a.type) || 'random';
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Data type", labelWidth: 14 },
            React.createElement(Select, { options: options.map((o) => ({
                    label: o,
                    value: o,
                })), value: options.find((item) => item === type), onChange: (value) => onChange(Object.assign(Object.assign({}, query.nodes), { type: value.value })), width: 32 })),
        (type === 'random' || type === 'random edges') && (React.createElement(InlineField, { label: "Count", labelWidth: 14 },
            React.createElement(Input, { type: "number", name: "count", value: (_b = query.nodes) === null || _b === void 0 ? void 0 : _b.count, width: 32, onChange: (e) => onChange(Object.assign(Object.assign({}, query.nodes), { count: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : 0 })), placeholder: "10" })))));
}
const options = ['random', 'response', 'random edges'];
//# sourceMappingURL=NodeGraphEditor.js.map
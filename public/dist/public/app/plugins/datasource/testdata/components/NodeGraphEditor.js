import { __assign } from "tslib";
import React from 'react';
import { Input, InlineFieldRow, InlineField, Select } from '@grafana/ui';
export function NodeGraphEditor(_a) {
    var _b, _c;
    var query = _a.query, onChange = _a.onChange;
    var type = ((_b = query.nodes) === null || _b === void 0 ? void 0 : _b.type) || 'random';
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Data type", labelWidth: 14 },
            React.createElement(Select, { options: options.map(function (o) { return ({
                    label: o,
                    value: o,
                }); }), value: options.find(function (item) { return item === type; }), onChange: function (value) { return onChange(__assign(__assign({}, query.nodes), { type: value.value })); }, width: 32 })),
        type === 'random' && (React.createElement(InlineField, { label: "Count", labelWidth: 14 },
            React.createElement(Input, { type: "number", name: "count", value: (_c = query.nodes) === null || _c === void 0 ? void 0 : _c.count, width: 32, onChange: function (e) {
                    return onChange(__assign(__assign({}, query.nodes), { count: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : 0 }));
                }, placeholder: "10" })))));
}
var options = ['random', 'response'];
//# sourceMappingURL=NodeGraphEditor.js.map
import { __assign } from "tslib";
import React from 'react';
import { InlineField, TextArea } from '@grafana/ui';
export var CSVContentEditor = function (_a) {
    var _b;
    var onChange = _a.onChange, query = _a.query;
    var onContent = function (e) {
        onChange(__assign(__assign({}, query), { csvContent: e.currentTarget.value }));
    };
    return (React.createElement(InlineField, { label: "CSV", labelWidth: 14 },
        React.createElement(TextArea, { width: "100%", rows: 10, onBlur: onContent, placeholder: "CSV content", defaultValue: (_b = query.csvContent) !== null && _b !== void 0 ? _b : '' })));
};
//# sourceMappingURL=CSVContentEditor.js.map
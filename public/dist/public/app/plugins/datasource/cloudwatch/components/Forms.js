import { __assign, __rest } from "tslib";
import React from 'react';
import { InlineFormLabel } from '@grafana/ui';
export var QueryField = function (_a) {
    var label = _a.label, tooltip = _a.tooltip, children = _a.children;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFormLabel, { width: 8, className: "query-keyword", tooltip: tooltip }, label),
        children));
};
export var QueryInlineField = function (_a) {
    var props = __rest(_a, []);
    return (React.createElement("div", { className: 'gf-form-inline' },
        React.createElement(QueryField, __assign({}, props)),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))));
};
//# sourceMappingURL=Forms.js.map
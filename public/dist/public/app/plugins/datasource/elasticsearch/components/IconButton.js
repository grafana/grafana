import { __assign, __makeTemplateObject, __rest } from "tslib";
import { Icon } from '@grafana/ui';
import { cx, css } from '@emotion/css';
import React from 'react';
var SROnly = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  clip: rect(0 0 0 0);\n  clip-path: inset(50%);\n  height: 1px;\n  overflow: hidden;\n  position: absolute;\n  white-space: nowrap;\n  width: 1px;\n"], ["\n  clip: rect(0 0 0 0);\n  clip-path: inset(50%);\n  height: 1px;\n  overflow: hidden;\n  position: absolute;\n  white-space: nowrap;\n  width: 1px;\n"])));
export var IconButton = function (_a) {
    var iconName = _a.iconName, onClick = _a.onClick, className = _a.className, label = _a.label, buttonProps = __rest(_a, ["iconName", "onClick", "className", "label"]);
    return (React.createElement("button", __assign({ className: cx('gf-form-label gf-form-label--btn query-part', className), onClick: onClick }, buttonProps),
        React.createElement("span", { className: SROnly }, label),
        React.createElement(Icon, { name: iconName, "aria-hidden": "true" })));
};
var templateObject_1;
//# sourceMappingURL=IconButton.js.map
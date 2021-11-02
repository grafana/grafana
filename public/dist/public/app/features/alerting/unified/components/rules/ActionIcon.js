import { __assign, __makeTemplateObject, __rest } from "tslib";
import { Icon, useStyles, Tooltip } from '@grafana/ui';
import React from 'react';
import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';
export var ActionIcon = function (_a) {
    var tooltip = _a.tooltip, icon = _a.icon, to = _a.to, target = _a.target, onClick = _a.onClick, className = _a.className, _b = _a.tooltipPlacement, tooltipPlacement = _b === void 0 ? 'top' : _b, rest = __rest(_a, ["tooltip", "icon", "to", "target", "onClick", "className", "tooltipPlacement"]);
    var iconEl = React.createElement(Icon, __assign({ className: cx(useStyles(getStyle), className), onClick: onClick, name: icon }, rest));
    return (React.createElement(Tooltip, { content: tooltip, placement: tooltipPlacement }, (function () {
        if (to) {
            return (React.createElement(Link, { to: to, target: target }, iconEl));
        }
        return iconEl;
    })()));
};
export var getStyle = function () { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  cursor: pointer;\n"], ["\n  cursor: pointer;\n"]))); };
var templateObject_1;
//# sourceMappingURL=ActionIcon.js.map
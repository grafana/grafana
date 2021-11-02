import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
export var FilterPill = function (_a) {
    var label = _a.label, selected = _a.selected, onClick = _a.onClick, _b = _a.icon, icon = _b === void 0 ? 'check' : _b;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.wrapper, selected && styles.selected), onClick: onClick },
        React.createElement("span", null, label),
        selected && React.createElement(Icon, { name: icon, className: styles.icon })));
};
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: ", " ", ";\n      background: ", ";\n      border-radius: ", ";\n      padding: ", ";\n      font-weight: ", ";\n      font-size: ", ";\n      color: ", ";\n      display: flex;\n      align-items: center;\n      height: 32px;\n      cursor: pointer;\n\n      &:hover {\n        background: ", ";\n        color: ", ";\n      }\n    "], ["\n      padding: ", " ", ";\n      background: ", ";\n      border-radius: ", ";\n      padding: ", ";\n      font-weight: ", ";\n      font-size: ", ";\n      color: ", ";\n      display: flex;\n      align-items: center;\n      height: 32px;\n      cursor: pointer;\n\n      &:hover {\n        background: ", ";\n        color: ", ";\n      }\n    "])), theme.spacing(0.25), theme.spacing(1), theme.colors.background.secondary, theme.shape.borderRadius(8), theme.spacing(0, 2), theme.typography.fontWeightMedium, theme.typography.size.sm, theme.colors.text.secondary, theme.colors.action.hover, theme.colors.text.primary),
        selected: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      background: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      color: ", ";\n      background: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.colors.text.primary, theme.colors.action.selected, theme.colors.action.focus),
        icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(0.5)),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=FilterPill.js.map
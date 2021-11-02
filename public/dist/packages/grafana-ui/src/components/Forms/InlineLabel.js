import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { useTheme } from '../../themes';
export var InlineLabel = function (_a) {
    var children = _a.children, className = _a.className, tooltip = _a.tooltip, width = _a.width, transparent = _a.transparent, _b = _a.as, Component = _b === void 0 ? 'label' : _b, rest = __rest(_a, ["children", "className", "tooltip", "width", "transparent", "as"]);
    var theme = useTheme();
    var styles = getInlineLabelStyles(theme, transparent, width);
    return (React.createElement(Component, __assign({ className: cx(styles.label, className) }, rest),
        children,
        tooltip && (React.createElement(Tooltip, { placement: "top", content: tooltip, theme: "info" },
            React.createElement(Icon, { name: "info-circle", size: "sm", className: styles.icon })))));
};
export var getInlineLabelStyles = function (theme, transparent, width) {
    if (transparent === void 0) { transparent = false; }
    return {
        label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      flex-shrink: 0;\n      padding: 0 ", ";\n      font-weight: ", ";\n      font-size: ", ";\n      background-color: ", ";\n      height: ", "px;\n      line-height: ", "px;\n      margin-right: ", ";\n      border-radius: ", ";\n      border: none;\n      width: ", ";\n      color: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      flex-shrink: 0;\n      padding: 0 ", ";\n      font-weight: ", ";\n      font-size: ", ";\n      background-color: ", ";\n      height: ", "px;\n      line-height: ", "px;\n      margin-right: ", ";\n      border-radius: ", ";\n      border: none;\n      width: ", ";\n      color: ", ";\n    "])), theme.spacing.sm, theme.typography.weight.semibold, theme.typography.size.sm, transparent ? 'transparent' : theme.colors.bg2, theme.height.md, theme.height.md, theme.spacing.xs, theme.border.radius.md, width ? (width !== 'auto' ? 8 * width + "px" : width) : '100%', theme.colors.textHeading),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      margin-left: 10px;\n\n      :hover {\n        color: ", ";\n      }\n    "], ["\n      color: ", ";\n      margin-left: 10px;\n\n      :hover {\n        color: ", ";\n      }\n    "])), theme.colors.textWeak, theme.colors.text),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=InlineLabel.js.map
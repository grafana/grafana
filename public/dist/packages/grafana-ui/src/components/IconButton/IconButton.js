import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { Icon, getSvgSize } from '../Icon/Icon';
import { stylesFactory } from '../../themes/stylesFactory';
import { css, cx } from '@emotion/css';
import { useTheme2 } from '../../themes/ThemeContext';
import { colorManipulator } from '@grafana/data';
import { Tooltip } from '../Tooltip/Tooltip';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
export var IconButton = React.forwardRef(function (_a, ref) {
    var name = _a.name, _b = _a.size, size = _b === void 0 ? 'md' : _b, iconType = _a.iconType, tooltip = _a.tooltip, tooltipPlacement = _a.tooltipPlacement, ariaLabel = _a.ariaLabel, className = _a.className, _c = _a.variant, variant = _c === void 0 ? 'secondary' : _c, restProps = __rest(_a, ["name", "size", "iconType", "tooltip", "tooltipPlacement", "ariaLabel", "className", "variant"]);
    var theme = useTheme2();
    var styles = getStyles(theme, size, variant);
    var button = (React.createElement("button", __assign({ ref: ref, "aria-label": ariaLabel || tooltip || '' }, restProps, { className: cx(styles.button, className) }),
        React.createElement(Icon, { name: name, size: size, className: styles.icon, type: iconType })));
    if (tooltip) {
        return (React.createElement(Tooltip, { content: tooltip, placement: tooltipPlacement }, button));
    }
    return button;
});
IconButton.displayName = 'IconButton';
var getStyles = stylesFactory(function (theme, size, variant) {
    var pixelSize = getSvgSize(size);
    var hoverSize = Math.max(pixelSize / 3, 8);
    var iconColor = theme.colors.text.primary;
    if (variant === 'primary') {
        iconColor = theme.colors.primary.text;
    }
    else if (variant === 'destructive') {
        iconColor = theme.colors.error.text;
    }
    return {
        button: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: ", "px;\n      height: ", "px;\n      background: transparent;\n      border: none;\n      color: ", ";\n      padding: 0;\n      margin: 0;\n      outline: none;\n      box-shadow: none;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      position: relative;\n      border-radius: ", ";\n      z-index: 0;\n      margin-right: ", ";\n\n      &[disabled],\n      &:disabled {\n        cursor: not-allowed;\n        color: ", ";\n        opacity: 0.65;\n        box-shadow: none;\n      }\n\n      &:before {\n        content: '';\n        display: block;\n        opacity: 1;\n        position: absolute;\n        transition-duration: 0.2s;\n        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n        z-index: -1;\n        bottom: -", "px;\n        left: -", "px;\n        right: -", "px;\n        top: -", "px;\n        background: none;\n        border-radius: 50%;\n        box-sizing: border-box;\n        transform: scale(0);\n        transition-property: transform, opacity;\n      }\n\n      &:focus,\n      &:focus-visible {\n        ", "\n      }\n\n      &:focus:not(:focus-visible) {\n        ", "\n      }\n\n      &:hover {\n        color: ", ";\n\n        &:before {\n          background-color: ", ";\n          border: none;\n          box-shadow: none;\n          opacity: 1;\n          transform: scale(0.8);\n        }\n      }\n    "], ["\n      width: ", "px;\n      height: ", "px;\n      background: transparent;\n      border: none;\n      color: ", ";\n      padding: 0;\n      margin: 0;\n      outline: none;\n      box-shadow: none;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      position: relative;\n      border-radius: ", ";\n      z-index: 0;\n      margin-right: ", ";\n\n      &[disabled],\n      &:disabled {\n        cursor: not-allowed;\n        color: ", ";\n        opacity: 0.65;\n        box-shadow: none;\n      }\n\n      &:before {\n        content: '';\n        display: block;\n        opacity: 1;\n        position: absolute;\n        transition-duration: 0.2s;\n        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n        z-index: -1;\n        bottom: -", "px;\n        left: -", "px;\n        right: -", "px;\n        top: -", "px;\n        background: none;\n        border-radius: 50%;\n        box-sizing: border-box;\n        transform: scale(0);\n        transition-property: transform, opacity;\n      }\n\n      &:focus,\n      &:focus-visible {\n        ", "\n      }\n\n      &:focus:not(:focus-visible) {\n        ", "\n      }\n\n      &:hover {\n        color: ", ";\n\n        &:before {\n          background-color: ", ";\n          border: none;\n          box-shadow: none;\n          opacity: 1;\n          transform: scale(0.8);\n        }\n      }\n    "])), pixelSize, pixelSize, iconColor, theme.shape.borderRadius(), theme.spacing(0.5), theme.colors.action.disabledText, hoverSize, hoverSize, hoverSize, hoverSize, getFocusStyles(theme), getMouseFocusStyles(theme), iconColor, variant === 'secondary'
            ? theme.colors.action.hover
            : colorManipulator.alpha(iconColor, 0.12)),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: 0;\n      vertical-align: baseline;\n      display: flex;\n    "], ["\n      margin-bottom: 0;\n      vertical-align: baseline;\n      display: flex;\n    "]))),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=IconButton.js.map
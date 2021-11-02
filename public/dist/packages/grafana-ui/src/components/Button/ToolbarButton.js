import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { forwardRef } from 'react';
import { cx, css } from '@emotion/css';
import { styleMixins, useStyles2 } from '../../themes';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { getPropertiesForVariant } from './Button';
import { isString } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
export var ToolbarButton = forwardRef(function (_a, ref) {
    var _b, _c;
    var tooltip = _a.tooltip, icon = _a.icon, className = _a.className, children = _a.children, imgSrc = _a.imgSrc, imgAlt = _a.imgAlt, fullWidth = _a.fullWidth, isOpen = _a.isOpen, narrow = _a.narrow, _d = _a.variant, variant = _d === void 0 ? 'default' : _d, iconOnly = _a.iconOnly, ariaLabel = _a["aria-label"], rest = __rest(_a, ["tooltip", "icon", "className", "children", "imgSrc", "imgAlt", "fullWidth", "isOpen", "narrow", "variant", "iconOnly", 'aria-label']);
    var styles = useStyles2(getStyles);
    var buttonStyles = cx('toolbar-button', (_b = {},
        _b[styles.button] = true,
        _b[styles.buttonFullWidth] = fullWidth,
        _b[styles.narrow] = narrow,
        _b), styles[variant], className);
    var contentStyles = cx((_c = {},
        _c[styles.content] = true,
        _c[styles.contentWithIcon] = !!icon,
        _c[styles.contentWithRightIcon] = isOpen !== undefined,
        _c));
    var body = (React.createElement("button", __assign({ ref: ref, className: buttonStyles, "aria-label": getButtonAriaLabel(ariaLabel, tooltip), "aria-expanded": isOpen }, rest),
        renderIcon(icon),
        imgSrc && React.createElement("img", { className: styles.img, src: imgSrc, alt: imgAlt !== null && imgAlt !== void 0 ? imgAlt : '' }),
        children && !iconOnly && React.createElement("div", { className: contentStyles }, children),
        isOpen === false && React.createElement(Icon, { name: "angle-down" }),
        isOpen === true && React.createElement(Icon, { name: "angle-up" })));
    return tooltip ? (React.createElement(Tooltip, { content: tooltip, placement: "bottom" }, body)) : (body);
});
function getButtonAriaLabel(ariaLabel, tooltip) {
    return ariaLabel ? ariaLabel : tooltip ? selectors.components.PageToolbar.item(tooltip) : undefined;
}
function renderIcon(icon) {
    if (!icon) {
        return null;
    }
    if (isString(icon)) {
        return React.createElement(Icon, { name: icon, size: 'lg' });
    }
    return icon;
}
var getStyles = function (theme) {
    var primaryVariant = getPropertiesForVariant(theme, 'primary', 'solid');
    var destructiveVariant = getPropertiesForVariant(theme, 'destructive', 'solid');
    return {
        button: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: toolbar-button;\n      display: flex;\n      align-items: center;\n      height: ", ";\n      padding: ", ";\n      border-radius: ", ";\n      line-height: ", "px;\n      font-weight: ", ";\n      border: 1px solid ", ";\n      white-space: nowrap;\n      transition: ", ";\n\n      &:focus,\n      &:focus-visible {\n        ", "\n        z-index: 1;\n      }\n\n      &:focus:not(:focus-visible) {\n        ", "\n      }\n\n      &:hover {\n        box-shadow: ", ";\n      }\n\n      &[disabled],\n      &:disabled {\n        cursor: not-allowed;\n        opacity: ", ";\n        background: ", ";\n        box-shadow: none;\n\n        &:hover {\n          color: ", ";\n          background: ", ";\n          box-shadow: none;\n        }\n      }\n    "], ["\n      label: toolbar-button;\n      display: flex;\n      align-items: center;\n      height: ", ";\n      padding: ", ";\n      border-radius: ", ";\n      line-height: ", "px;\n      font-weight: ", ";\n      border: 1px solid ", ";\n      white-space: nowrap;\n      transition: ", ";\n\n      &:focus,\n      &:focus-visible {\n        ", "\n        z-index: 1;\n      }\n\n      &:focus:not(:focus-visible) {\n        ", "\n      }\n\n      &:hover {\n        box-shadow: ", ";\n      }\n\n      &[disabled],\n      &:disabled {\n        cursor: not-allowed;\n        opacity: ", ";\n        background: ", ";\n        box-shadow: none;\n\n        &:hover {\n          color: ", ";\n          background: ", ";\n          box-shadow: none;\n        }\n      }\n    "])), theme.spacing(theme.components.height.md), theme.spacing(0, 1), theme.shape.borderRadius(), theme.components.height.md * theme.spacing.gridSize - 2, theme.typography.fontWeightMedium, theme.colors.border.weak, theme.transitions.create(['background', 'box-shadow', 'border-color', 'color'], {
            duration: theme.transitions.duration.short,
        }), getFocusStyles(theme), getMouseFocusStyles(theme), theme.shadows.z1, theme.colors.action.disabledOpacity, theme.colors.action.disabledBackground, theme.colors.text.disabled, theme.colors.action.disabledBackground),
        default: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      background-color: ", ";\n\n      &:hover {\n        color: ", ";\n        background: ", ";\n      }\n    "], ["\n      color: ", ";\n      background-color: ", ";\n\n      &:hover {\n        color: ", ";\n        background: ", ";\n      }\n    "])), theme.colors.text.secondary, theme.colors.background.primary, theme.colors.text.primary, theme.colors.background.secondary),
        active: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      color: ", ";\n      border-color: ", ";\n      background-color: transparent;\n\n      &:hover {\n        color: ", ";\n        background: ", ";\n      }\n    "], ["\n      color: ", ";\n      border-color: ", ";\n      background-color: transparent;\n\n      &:hover {\n        color: ", ";\n        background: ", ";\n      }\n    "])), theme.v1.palette.orangeDark, theme.v1.palette.orangeDark, theme.colors.text.primary, theme.colors.emphasize(theme.colors.background.canvas, 0.03)),
        primary: css(primaryVariant),
        destructive: css(destructiveVariant),
        narrow: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      padding: 0 ", ";\n    "], ["\n      padding: 0 ", ";\n    "])), theme.spacing(0.5)),
        img: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      width: 16px;\n      height: 16px;\n      margin-right: ", ";\n    "], ["\n      width: 16px;\n      height: 16px;\n      margin-right: ", ";\n    "])), theme.spacing(1)),
        buttonFullWidth: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      flex-grow: 1;\n    "], ["\n      flex-grow: 1;\n    "]))),
        content: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      flex-grow: 1;\n    "], ["\n      flex-grow: 1;\n    "]))),
        contentWithIcon: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      display: none;\n      padding-left: ", ";\n\n      @media ", " {\n        display: block;\n      }\n    "], ["\n      display: none;\n      padding-left: ", ";\n\n      @media ", " {\n        display: block;\n      }\n    "])), theme.spacing(1), styleMixins.mediaUp(theme.v1.breakpoints.md)),
        contentWithRightIcon: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      padding-right: ", ";\n    "], ["\n      padding-right: ", ";\n    "])), theme.spacing(0.5)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=ToolbarButton.js.map
import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useTheme2 } from '../../themes';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { colorManipulator } from '@grafana/data';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';
export var allButtonVariants = ['primary', 'secondary', 'destructive'];
export var allButtonFills = ['solid', 'outline', 'text'];
export var Button = React.forwardRef(function (_a, ref) {
    var _b = _a.variant, variant = _b === void 0 ? 'primary' : _b, _c = _a.size, size = _c === void 0 ? 'md' : _c, _d = _a.fill, fill = _d === void 0 ? 'solid' : _d, icon = _a.icon, fullWidth = _a.fullWidth, children = _a.children, className = _a.className, otherProps = __rest(_a, ["variant", "size", "fill", "icon", "fullWidth", "children", "className"]);
    var theme = useTheme2();
    var styles = getButtonStyles({
        theme: theme,
        size: size,
        variant: variant,
        fill: fill,
        fullWidth: fullWidth,
        iconOnly: !children,
    });
    deprecatedPropWarning(variant === 'link', Button.displayName + ": Prop variant=\"link\" is deprecated. Please use fill=\"text\".");
    return (React.createElement("button", __assign({ className: cx(styles.button, className) }, otherProps, { ref: ref }),
        icon && React.createElement(Icon, { name: icon, size: size, className: styles.icon }),
        children && React.createElement("span", { className: styles.content }, children)));
});
Button.displayName = 'Button';
export var LinkButton = React.forwardRef(function (_a, ref) {
    var _b;
    var _c = _a.variant, variant = _c === void 0 ? 'primary' : _c, _d = _a.size, size = _d === void 0 ? 'md' : _d, _e = _a.fill, fill = _e === void 0 ? 'solid' : _e, icon = _a.icon, fullWidth = _a.fullWidth, children = _a.children, className = _a.className, onBlur = _a.onBlur, onFocus = _a.onFocus, disabled = _a.disabled, otherProps = __rest(_a, ["variant", "size", "fill", "icon", "fullWidth", "children", "className", "onBlur", "onFocus", "disabled"]);
    var theme = useTheme2();
    var styles = getButtonStyles({
        theme: theme,
        fullWidth: fullWidth,
        size: size,
        variant: variant,
        fill: fill,
        iconOnly: !children,
    });
    var linkButtonStyles = cx(styles.button, (_b = {}, _b[styles.disabled] = disabled, _b), className);
    deprecatedPropWarning(variant === 'link', LinkButton.displayName + ": Prop variant=\"link\" is deprecated. Please use fill=\"text\".");
    return (React.createElement("a", __assign({ className: linkButtonStyles }, otherProps, { tabIndex: disabled ? -1 : 0, ref: ref }),
        icon && React.createElement(Icon, { name: icon, size: size, className: styles.icon }),
        children && React.createElement("span", { className: styles.content }, children)));
});
LinkButton.displayName = 'LinkButton';
export var getButtonStyles = function (props) {
    var theme = props.theme, variant = props.variant, _a = props.fill, fill = _a === void 0 ? 'solid' : _a, size = props.size, iconOnly = props.iconOnly, fullWidth = props.fullWidth;
    var _b = getPropertiesForButtonSize(size, theme), height = _b.height, padding = _b.padding, fontSize = _b.fontSize;
    var variantStyles = getPropertiesForVariant(theme, variant, fill);
    var disabledStyles = getPropertiesForDisabled(theme, variant, fill);
    var focusStyle = getFocusStyles(theme);
    var paddingMinusBorder = theme.spacing.gridSize * padding - 1;
    return {
        button: css(__assign(__assign(__assign({ label: 'button', display: 'inline-flex', alignItems: 'center', fontSize: fontSize, fontWeight: theme.typography.fontWeightMedium, fontFamily: theme.typography.fontFamily, padding: "0 " + paddingMinusBorder + "px", height: theme.spacing(height), 
            // Deduct border from line-height for perfect vertical centering on windows and linux
            lineHeight: theme.spacing.gridSize * height - 2 + "px", verticalAlign: 'middle', cursor: 'pointer', borderRadius: theme.shape.borderRadius(1), '&:focus': focusStyle, '&:focus-visible': focusStyle, '&:focus:not(:focus-visible)': getMouseFocusStyles(theme) }, (fullWidth && {
            flexGrow: 1,
            justifyContent: 'center',
        })), variantStyles), { ':disabled': disabledStyles, '&[disabled]': disabledStyles })),
        disabled: css(disabledStyles),
        img: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 16px;\n      height: 16px;\n      margin: ", ";\n    "], ["\n      width: 16px;\n      height: 16px;\n      margin: ", ";\n    "])), theme.spacing(0, 1, 0, 0.5)),
        icon: iconOnly
            ? css({
                // Important not to set margin bottom here as it would override internal icon bottom margin
                marginRight: theme.spacing(-padding / 2),
                marginLeft: theme.spacing(-padding / 2),
            })
            : css({
                marginRight: theme.spacing(padding / 2),
            }),
        content: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n      white-space: nowrap;\n      height: 100%;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n      white-space: nowrap;\n      height: 100%;\n    "]))),
    };
};
function getButtonVariantStyles(theme, color, fill) {
    if (fill === 'outline') {
        return {
            background: 'transparent',
            color: color.text,
            border: "1px solid " + color.border,
            transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
                duration: theme.transitions.duration.short,
            }),
            '&:hover': {
                background: colorManipulator.alpha(color.main, theme.colors.action.hoverOpacity),
                borderColor: theme.colors.emphasize(color.border, 0.25),
                color: color.text,
            },
        };
    }
    if (fill === 'text') {
        return {
            background: 'transparent',
            color: color.text,
            border: '1px solid transparent',
            transition: theme.transitions.create(['background-color', 'color'], {
                duration: theme.transitions.duration.short,
            }),
            '&:focus': {
                outline: 'none',
                textDecoration: 'none',
            },
            '&:hover': {
                background: colorManipulator.alpha(color.shade, theme.colors.action.hoverOpacity),
                textDecoration: 'none',
            },
        };
    }
    return {
        background: color.main,
        color: color.contrastText,
        border: "1px solid transparent",
        transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
            duration: theme.transitions.duration.short,
        }),
        '&:hover': {
            background: color.shade,
            color: color.contrastText,
            boxShadow: theme.shadows.z1,
        },
    };
}
function getPropertiesForDisabled(theme, variant, fill) {
    var disabledStyles = {
        cursor: 'not-allowed',
        boxShadow: 'none',
        pointerEvents: 'none',
        color: theme.colors.text.disabled,
        transition: 'none',
    };
    if (fill === 'text' || variant === 'link') {
        return __assign(__assign({}, disabledStyles), { background: 'transparent', border: "1px solid transparent" });
    }
    if (fill === 'outline') {
        return __assign(__assign({}, disabledStyles), { background: 'transparent', border: "1px solid " + theme.colors.action.disabledText });
    }
    return __assign(__assign({}, disabledStyles), { background: theme.colors.action.disabledBackground, border: "1px solid transparent" });
}
export function getPropertiesForVariant(theme, variant, fill) {
    var buttonVariant = variant === 'link' ? 'primary' : variant;
    var buttonFill = variant === 'link' ? 'text' : fill;
    switch (buttonVariant) {
        case 'secondary':
            return getButtonVariantStyles(theme, theme.colors.secondary, buttonFill);
        case 'destructive':
            return getButtonVariantStyles(theme, theme.colors.error, buttonFill);
        case 'primary':
        default:
            return getButtonVariantStyles(theme, theme.colors.primary, buttonFill);
    }
}
function deprecatedPropWarning(test, message) {
    if (process.env.NODE_ENV === 'development' && test) {
        console.warn("@grafana/ui " + message);
    }
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=Button.js.map
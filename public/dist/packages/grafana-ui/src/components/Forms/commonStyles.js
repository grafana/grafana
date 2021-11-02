import { __makeTemplateObject } from "tslib";
import { css, cx } from '@emotion/css';
import { focusCss } from '../../themes/mixins';
export var getFocusStyle = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  &:focus {\n    ", "\n  }\n"], ["\n  &:focus {\n    ", "\n  }\n"])), focusCss(theme)); };
export var sharedInputStyle = function (theme, invalid) {
    if (invalid === void 0) { invalid = false; }
    var borderColor = invalid ? theme.colors.error.border : theme.components.input.borderColor;
    var borderColorHover = invalid ? theme.colors.error.shade : theme.components.input.borderHover;
    var background = theme.components.input.background;
    var textColor = theme.components.input.text;
    // Cannot use our normal borders for this color for some reason due the alpha values in them.
    // Need to colors without alpha channel
    var autoFillBorder = theme.isDark ? '#2e2f35' : '#bab4ca';
    return cx(inputPadding(theme), css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      line-height: ", ";\n      font-size: ", ";\n      color: ", ";\n      border: 1px solid ", ";\n\n      &:-webkit-autofill,\n      &:-webkit-autofill:hover {\n        /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */\n        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ", "!important;\n        -webkit-text-fill-color: ", " !important;\n        border-color: ", ";\n      }\n\n      &:-webkit-autofill:focus {\n        /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */\n        box-shadow: 0 0 0 2px ", ", 0 0 0px 4px ", ",\n          inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ", "!important;\n        -webkit-text-fill-color: ", " !important;\n      }\n\n      &:hover {\n        border-color: ", ";\n      }\n\n      &:focus {\n        outline: none;\n      }\n\n      &:disabled {\n        background-color: ", ";\n        color: ", ";\n        border: 1px solid ", ";\n\n        &:hover {\n          border-color: ", ";\n        }\n      }\n\n      &::placeholder {\n        color: ", ";\n        opacity: 1;\n      }\n    "], ["\n      background: ", ";\n      line-height: ", ";\n      font-size: ", ";\n      color: ", ";\n      border: 1px solid ", ";\n\n      &:-webkit-autofill,\n      &:-webkit-autofill:hover {\n        /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */\n        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ", "!important;\n        -webkit-text-fill-color: ", " !important;\n        border-color: ", ";\n      }\n\n      &:-webkit-autofill:focus {\n        /* Welcome to 2005. This is a HACK to get rid od Chromes default autofill styling */\n        box-shadow: 0 0 0 2px ", ", 0 0 0px 4px ", ",\n          inset 0 0 0 1px rgba(255, 255, 255, 0), inset 0 0 0 100px ", "!important;\n        -webkit-text-fill-color: ", " !important;\n      }\n\n      &:hover {\n        border-color: ", ";\n      }\n\n      &:focus {\n        outline: none;\n      }\n\n      &:disabled {\n        background-color: ", ";\n        color: ", ";\n        border: 1px solid ", ";\n\n        &:hover {\n          border-color: ", ";\n        }\n      }\n\n      &::placeholder {\n        color: ", ";\n        opacity: 1;\n      }\n    "])), background, theme.typography.body.lineHeight, theme.typography.size.md, textColor, borderColor, background, textColor, autoFillBorder, theme.colors.background.primary, theme.colors.primary.main, background, textColor, borderColorHover, theme.colors.action.disabledBackground, theme.colors.action.disabledText, theme.colors.action.disabledBackground, borderColor, theme.colors.text.disabled));
};
export var inputPadding = function (theme) {
    return css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(0, 1, 0, 1));
};
export var inputSizes = function () {
    return {
        sm: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: ", ";\n    "], ["\n      width: ", ";\n    "])), inputSizesPixels('sm')),
        md: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      width: ", ";\n    "], ["\n      width: ", ";\n    "])), inputSizesPixels('md')),
        lg: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      width: ", ";\n    "], ["\n      width: ", ";\n    "])), inputSizesPixels('lg')),
        auto: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      width: ", ";\n    "], ["\n      width: ", ";\n    "])), inputSizesPixels('auto')),
    };
};
export var inputSizesPixels = function (size) {
    switch (size) {
        case 'sm':
            return '200px';
        case 'md':
            return '320px';
        case 'lg':
            return '580px';
        case 'auto':
        default:
            return 'auto';
    }
};
export function getPropertiesForButtonSize(size, theme) {
    switch (size) {
        case 'sm':
            return {
                padding: 1,
                fontSize: theme.typography.size.sm,
                height: theme.components.height.sm,
            };
        case 'lg':
            return {
                padding: 3,
                fontSize: theme.typography.size.lg,
                height: theme.components.height.lg,
            };
        case 'md':
        default:
            return {
                padding: 2,
                fontSize: theme.typography.size.md,
                height: theme.components.height.md,
            };
    }
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=commonStyles.js.map
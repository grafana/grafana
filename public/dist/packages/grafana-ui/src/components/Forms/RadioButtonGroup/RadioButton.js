import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useTheme2, stylesFactory } from '../../../themes';
import { css } from '@emotion/css';
import { getPropertiesForButtonSize } from '../commonStyles';
import { getFocusStyles, getMouseFocusStyles } from '../../../themes/mixins';
export var RadioButton = function (_a) {
    var children = _a.children, _b = _a.active, active = _b === void 0 ? false : _b, _c = _a.disabled, disabled = _c === void 0 ? false : _c, _d = _a.size, size = _d === void 0 ? 'md' : _d, onChange = _a.onChange, id = _a.id, _e = _a.name, name = _e === void 0 ? undefined : _e, description = _a.description, fullWidth = _a.fullWidth, ariaLabel = _a["aria-label"];
    var theme = useTheme2();
    var styles = getRadioButtonStyles(theme, size, fullWidth);
    return (React.createElement(React.Fragment, null,
        React.createElement("input", { type: "radio", className: styles.radio, onChange: onChange, disabled: disabled, id: id, checked: active, name: name, "aria-label": ariaLabel }),
        React.createElement("label", { className: styles.radioLabel, htmlFor: id, title: description }, children)));
};
RadioButton.displayName = 'RadioButton';
var getRadioButtonStyles = stylesFactory(function (theme, size, fullWidth) {
    var _a = getPropertiesForButtonSize(size, theme), fontSize = _a.fontSize, height = _a.height, padding = _a.padding;
    var textColor = theme.colors.text.secondary;
    var textColorHover = theme.colors.text.primary;
    // remove the group inner padding (set on RadioButtonGroup)
    var labelHeight = height * theme.spacing.gridSize - 4 - 2;
    return {
        radio: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: absolute;\n      opacity: 0;\n      z-index: -1000;\n\n      &:checked + label {\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n        z-index: 3;\n      }\n\n      &:focus + label,\n      &:focus-visible + label {\n        ", ";\n      }\n\n      &:focus:not(:focus-visible) + label {\n        ", "\n      }\n\n      &:disabled + label {\n        color: ", ";\n        cursor: not-allowed;\n      }\n    "], ["\n      position: absolute;\n      opacity: 0;\n      z-index: -1000;\n\n      &:checked + label {\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n        z-index: 3;\n      }\n\n      &:focus + label,\n      &:focus-visible + label {\n        ", ";\n      }\n\n      &:focus:not(:focus-visible) + label {\n        ", "\n      }\n\n      &:disabled + label {\n        color: ", ";\n        cursor: not-allowed;\n      }\n    "])), theme.colors.text.primary, theme.typography.fontWeightMedium, theme.colors.action.selected, getFocusStyles(theme), getMouseFocusStyles(theme), theme.colors.text.disabled),
        radioLabel: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: inline-block;\n      position: relative;\n      font-size: ", ";\n      height: ", "px;\n      // Deduct border from line-height for perfect vertical centering on windows and linux\n      line-height: ", "px;\n      color: ", ";\n      padding: ", ";\n      border-radius: ", ";\n      background: ", ";\n      cursor: pointer;\n      z-index: 1;\n      flex: ", ";\n      text-align: center;\n      user-select: none;\n      white-space: nowrap;\n\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      display: inline-block;\n      position: relative;\n      font-size: ", ";\n      height: ", "px;\n      // Deduct border from line-height for perfect vertical centering on windows and linux\n      line-height: ", "px;\n      color: ", ";\n      padding: ", ";\n      border-radius: ", ";\n      background: ", ";\n      cursor: pointer;\n      z-index: 1;\n      flex: ", ";\n      text-align: center;\n      user-select: none;\n      white-space: nowrap;\n\n      &:hover {\n        color: ", ";\n      }\n    "])), fontSize, labelHeight, labelHeight, textColor, theme.spacing(0, padding), theme.shape.borderRadius(), theme.colors.background.primary, fullWidth ? "1 0 0" : 'none', textColorHover),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=RadioButton.js.map
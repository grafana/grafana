import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
import { stylesFactory, useTheme2 } from '../../themes';
export var getFieldValidationMessageStyles = stylesFactory(function (theme) {
    var baseStyle = "\n      font-size: " + theme.typography.size.sm + ";\n      font-weight: " + theme.typography.fontWeightMedium + ";\n      padding: " + theme.spacing(0.5, 1) + ";\n      color: " + theme.colors.error.contrastText + ";\n      background: " + theme.colors.error.main + ";\n      border-radius: " + theme.shape.borderRadius() + ";\n      position: relative;\n      display: inline-block;\n    ";
    return {
        vertical: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      ", "\n      margin: ", ";\n\n      &:before {\n        content: '';\n        position: absolute;\n        left: 9px;\n        top: -5px;\n        width: 0;\n        height: 0;\n        border-width: 0 4px 5px 4px;\n        border-color: transparent transparent ", " transparent;\n        border-style: solid;\n      }\n    "], ["\n      ", "\n      margin: ", ";\n\n      &:before {\n        content: '';\n        position: absolute;\n        left: 9px;\n        top: -5px;\n        width: 0;\n        height: 0;\n        border-width: 0 4px 5px 4px;\n        border-color: transparent transparent ", " transparent;\n        border-style: solid;\n      }\n    "])), baseStyle, theme.spacing(0.5, 0, 0, 0), theme.colors.error.main),
        horizontal: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      ", "\n      margin-left: 10px;\n\n      &:before {\n        content: '';\n        position: absolute;\n        left: -5px;\n        top: 9px;\n        width: 0;\n        height: 0;\n        border-width: 4px 5px 4px 0;\n        border-color: transparent #e02f44 transparent transparent;\n        border-style: solid;\n      }\n    "], ["\n      ", "\n      margin-left: 10px;\n\n      &:before {\n        content: '';\n        position: absolute;\n        left: -5px;\n        top: 9px;\n        width: 0;\n        height: 0;\n        border-width: 4px 5px 4px 0;\n        border-color: transparent #e02f44 transparent transparent;\n        border-style: solid;\n      }\n    "])), baseStyle),
        fieldValidationMessageIcon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing()),
    };
});
export var FieldValidationMessage = function (_a) {
    var children = _a.children, horizontal = _a.horizontal, className = _a.className;
    var theme = useTheme2();
    var styles = getFieldValidationMessageStyles(theme);
    var cssName = cx(horizontal ? styles.horizontal : styles.vertical, className);
    return (React.createElement("div", { role: "alert", className: cssName },
        React.createElement(Icon, { className: styles.fieldValidationMessageIcon, name: "exclamation-triangle" }),
        children));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=FieldValidationMessage.js.map
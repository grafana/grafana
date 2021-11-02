import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Button } from '../Button/Button';
function getIconFromSeverity(severity) {
    switch (severity) {
        case 'error':
        case 'warning':
            return 'exclamation-triangle';
        case 'info':
            return 'info-circle';
        case 'success':
            return 'check';
        default:
            return '';
    }
}
export var Alert = React.forwardRef(function (_a, ref) {
    var title = _a.title, onRemove = _a.onRemove, children = _a.children, buttonContent = _a.buttonContent, elevated = _a.elevated, bottomSpacing = _a.bottomSpacing, className = _a.className, _b = _a.severity, severity = _b === void 0 ? 'error' : _b, restProps = __rest(_a, ["title", "onRemove", "children", "buttonContent", "elevated", "bottomSpacing", "className", "severity"]);
    var theme = useTheme2();
    var styles = getStyles(theme, severity, elevated, bottomSpacing);
    return (React.createElement("div", __assign({ ref: ref, className: cx(styles.alert, className), "aria-label": selectors.components.Alert.alert(severity) }, restProps),
        React.createElement("div", { className: styles.icon },
            React.createElement(Icon, { size: "xl", name: getIconFromSeverity(severity) })),
        React.createElement("div", { className: styles.body },
            React.createElement("div", { className: styles.title }, title),
            children && React.createElement("div", { className: styles.content }, children)),
        onRemove && !buttonContent && (React.createElement("div", { className: styles.close },
            React.createElement(IconButton, { name: "times", onClick: onRemove, size: "lg", type: "button" }))),
        onRemove && buttonContent && (React.createElement("div", { className: styles.buttonWrapper },
            React.createElement(Button, { variant: "secondary", onClick: onRemove, type: "button" }, buttonContent)))));
});
Alert.displayName = 'Alert';
var getStyles = function (theme, severity, elevated, bottomSpacing) {
    var color = theme.colors[severity];
    var borderRadius = theme.shape.borderRadius();
    return {
        alert: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      flex-grow: 1;\n      position: relative;\n      border-radius: ", ";\n      display: flex;\n      flex-direction: row;\n      align-items: stretch;\n      background: ", ";\n      box-shadow: ", ";\n      margin-bottom: ", ";\n\n      &:before {\n        content: '';\n        position: absolute;\n        top: 0;\n        left: 0;\n        bottom: 0;\n        right: 0;\n        background: ", ";\n        z-index: -1;\n      }\n    "], ["\n      flex-grow: 1;\n      position: relative;\n      border-radius: ", ";\n      display: flex;\n      flex-direction: row;\n      align-items: stretch;\n      background: ", ";\n      box-shadow: ", ";\n      margin-bottom: ", ";\n\n      &:before {\n        content: '';\n        position: absolute;\n        top: 0;\n        left: 0;\n        bottom: 0;\n        right: 0;\n        background: ", ";\n        z-index: -1;\n      }\n    "])), borderRadius, theme.colors.background.secondary, elevated ? theme.shadows.z3 : theme.shadows.z1, theme.spacing(bottomSpacing !== null && bottomSpacing !== void 0 ? bottomSpacing : 2), theme.colors.background.primary),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: ", ";\n      background: ", ";\n      border-radius: ", " 0 0 ", ";\n      color: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      padding: ", ";\n      background: ", ";\n      border-radius: ", " 0 0 ", ";\n      color: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "])), theme.spacing(2, 3), color.main, borderRadius, borderRadius, color.contrastText),
        title: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-weight: ", ";\n      color: ", ";\n    "], ["\n      font-weight: ", ";\n      color: ", ";\n    "])), theme.typography.fontWeightMedium, theme.colors.text.primary),
        body: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      color: ", ";\n      padding: ", ";\n      flex-grow: 1;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      overflow-wrap: break-word;\n      word-break: break-word;\n    "], ["\n      color: ", ";\n      padding: ", ";\n      flex-grow: 1;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      overflow-wrap: break-word;\n      word-break: break-word;\n    "])), theme.colors.text.secondary, theme.spacing(2)),
        content: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      color: ", ";\n      padding-top: ", ";\n    "], ["\n      color: ", ";\n      padding-top: ", ";\n    "])), theme.colors.text.secondary, theme.spacing(1)),
        buttonWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      padding: ", ";\n      background: none;\n      display: flex;\n      align-items: center;\n    "], ["\n      padding: ", ";\n      background: none;\n      display: flex;\n      align-items: center;\n    "])), theme.spacing(1)),
        close: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      padding: ", ";\n      background: none;\n      display: flex;\n    "], ["\n      padding: ", ";\n      background: none;\n      display: flex;\n    "])), theme.spacing(2, 1)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=Alert.js.map
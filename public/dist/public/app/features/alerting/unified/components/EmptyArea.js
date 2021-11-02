import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Button, useStyles } from '@grafana/ui';
export var EmptyArea = function (_a) {
    var buttonIcon = _a.buttonIcon, buttonLabel = _a.buttonLabel, _b = _a.buttonSize, buttonSize = _b === void 0 ? 'lg' : _b, _c = _a.buttonVariant, buttonVariant = _c === void 0 ? 'primary' : _c, onButtonClick = _a.onButtonClick, text = _a.text;
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("p", { className: styles.text }, text),
        React.createElement(Button, { className: styles.button, icon: buttonIcon, onClick: onButtonClick, size: buttonSize, type: "button", variant: buttonVariant }, buttonLabel)));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background-color: ", ";\n      color: ", ";\n      padding: ", ";\n      text-align: center;\n    "], ["\n      background-color: ", ";\n      color: ", ";\n      padding: ", ";\n      text-align: center;\n    "])), theme.colors.bg2, theme.colors.textSemiWeak, theme.spacing.xl),
        text: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.md),
        button: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin: ", " 0 ", ";\n    "], ["\n      margin: ", " 0 ", ";\n    "])), theme.spacing.md, theme.spacing.sm),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=EmptyArea.js.map
import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes/ThemeContext';
export var CallToActionCard = function (_a) {
    var message = _a.message, callToActionElement = _a.callToActionElement, footer = _a.footer, className = _a.className;
    var css = useStyles2(getStyles);
    return (React.createElement("div", { className: cx([css.wrapper, className]) },
        message && React.createElement("div", { className: css.message }, message),
        callToActionElement,
        footer && React.createElement("div", { className: css.footer }, footer)));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: call-to-action-card;\n    padding: ", ";\n    background: ", ";\n    border-radius: ", ";\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    flex-grow: 1;\n  "], ["\n    label: call-to-action-card;\n    padding: ", ";\n    background: ", ";\n    border-radius: ", ";\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    flex-grow: 1;\n  "])), theme.spacing(3), theme.colors.background.secondary, theme.shape.borderRadius(2)),
    message: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-bottom: ", ";\n    font-style: italic;\n  "], ["\n    margin-bottom: ", ";\n    font-style: italic;\n  "])), theme.spacing(3)),
    footer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", "};\n  "], ["\n    margin-top: ", "};\n  "])), theme.spacing(3)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=CallToActionCard.js.map
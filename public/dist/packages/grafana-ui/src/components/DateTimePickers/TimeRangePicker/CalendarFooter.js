import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles2 } from '../../../themes';
import { Button } from '../../Button';
import { css } from '@emotion/css';
export function Footer(_a) {
    var onClose = _a.onClose, onApply = _a.onApply;
    var styles = useStyles2(getFooterStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(Button, { className: styles.apply, onClick: onApply }, "Apply time range"),
        React.createElement(Button, { variant: "secondary", onClick: onClose }, "Cancel")));
}
Footer.displayName = 'Footer';
var getFooterStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background-color: ", ";\n      display: flex;\n      justify-content: center;\n      padding: 10px;\n      align-items: stretch;\n    "], ["\n      background-color: ", ";\n      display: flex;\n      justify-content: center;\n      padding: 10px;\n      align-items: stretch;\n    "])), theme.colors.background.primary),
        apply: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-right: 4px;\n      width: 100%;\n      justify-content: center;\n    "], ["\n      margin-right: 4px;\n      width: 100%;\n      justify-content: center;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=CalendarFooter.js.map
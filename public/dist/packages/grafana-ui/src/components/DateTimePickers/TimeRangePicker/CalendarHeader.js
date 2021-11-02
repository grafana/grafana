import { __makeTemplateObject } from "tslib";
import React from 'react';
import { TimePickerTitle } from './TimePickerTitle';
import { Button } from '../../Button';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '../../../themes';
import { css } from '@emotion/css';
export function Header(_a) {
    var onClose = _a.onClose;
    var styles = useStyles2(getHeaderStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(TimePickerTitle, null, "Select a time range"),
        React.createElement(Button, { "aria-label": selectors.components.TimePicker.calendar.closeButton, icon: "times", variant: "secondary", onClick: onClose })));
}
Header.displayName = 'Header';
var getHeaderStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background-color: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      padding: 7px;\n    "], ["\n      background-color: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      padding: 7px;\n    "])), theme.colors.background.primary),
    };
};
var templateObject_1;
//# sourceMappingURL=CalendarHeader.js.map
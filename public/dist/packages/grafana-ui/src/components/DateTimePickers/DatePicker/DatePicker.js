import { __assign, __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import Calendar from 'react-calendar';
import { css } from 'emotion';
import { useStyles2 } from '../../../themes';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../../Icon/Icon';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';
/** @public */
export var DatePicker = memo(function (props) {
    var styles = useStyles2(getStyles);
    var isOpen = props.isOpen, onClose = props.onClose;
    if (!isOpen) {
        return null;
    }
    return (React.createElement(ClickOutsideWrapper, { useCapture: true, includeButtonPress: false, onClick: onClose },
        React.createElement("div", { className: styles.modal, "data-testid": "date-picker" },
            React.createElement(Body, __assign({}, props)))));
});
DatePicker.displayName = 'DatePicker';
var Body = memo(function (_a) {
    var value = _a.value, onChange = _a.onChange;
    var styles = useStyles2(getBodyStyles);
    return (React.createElement(Calendar, { className: styles.body, tileClassName: styles.title, value: value || new Date(), nextLabel: React.createElement(Icon, { name: "angle-right" }), prevLabel: React.createElement(Icon, { name: "angle-left" }), onChange: function (ev) {
            if (!Array.isArray(ev)) {
                onChange(ev);
            }
        }, locale: "en" }));
});
Body.displayName = 'Body';
export var getStyles = function (theme) {
    return {
        modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      z-index: ", ";\n      position: absolute;\n      box-shadow: ", ";\n      background-color: ", ";\n      border: 1px solid ", ";\n      border-radius: 2px 0 0 2px;\n    "], ["\n      z-index: ", ";\n      position: absolute;\n      box-shadow: ", ";\n      background-color: ", ";\n      border: 1px solid ", ";\n      border-radius: 2px 0 0 2px;\n    "])), theme.zIndex.modal, theme.shadows.z3, theme.colors.background.primary, theme.colors.border.weak),
    };
};
var templateObject_1;
//# sourceMappingURL=DatePicker.js.map
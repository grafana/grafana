import { __assign, __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from '@emotion/css';
import { useTheme2 } from '../../../themes';
import { Header } from './CalendarHeader';
import { Portal } from '../../Portal/Portal';
import { selectors } from '@grafana/e2e-selectors';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { Body } from './CalendarBody';
import { Footer } from './CalendarFooter';
export var getStyles = function (theme, isReversed) {
    if (isReversed === void 0) { isReversed = false; }
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      top: -1px;\n      position: absolute;\n      ", ": 544px;\n      box-shadow: ", ";\n      background-color: ", ";\n      z-index: -1;\n      border: 1px solid ", ";\n      border-radius: 2px 0 0 2px;\n\n      &:after {\n        display: block;\n        background-color: ", ";\n        width: 19px;\n        height: 100%;\n        content: ", ";\n        position: absolute;\n        top: 0;\n        right: -19px;\n        border-left: 1px solid ", ";\n      }\n    "], ["\n      top: -1px;\n      position: absolute;\n      ", ": 544px;\n      box-shadow: ", ";\n      background-color: ", ";\n      z-index: -1;\n      border: 1px solid ", ";\n      border-radius: 2px 0 0 2px;\n\n      &:after {\n        display: block;\n        background-color: ", ";\n        width: 19px;\n        height: 100%;\n        content: ", ";\n        position: absolute;\n        top: 0;\n        right: -19px;\n        border-left: 1px solid ", ";\n      }\n    "])), isReversed ? 'left' : 'right', theme.shadows.z3, theme.colors.background.primary, theme.colors.border.weak, theme.colors.background.primary, !isReversed ? ' ' : '', theme.colors.border.weak),
        modal: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: fixed;\n      top: 20%;\n      left: 25%;\n      width: 100%;\n      z-index: ", ";\n    "], ["\n      position: fixed;\n      top: 20%;\n      left: 25%;\n      width: 100%;\n      z-index: ", ";\n    "])), theme.zIndex.modal),
        content: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin: 0 auto;\n      width: 268px;\n    "], ["\n      margin: 0 auto;\n      width: 268px;\n    "]))),
        backdrop: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      position: fixed;\n      top: 0;\n      right: 0;\n      bottom: 0;\n      left: 0;\n      background: #202226;\n      opacity: 0.7;\n      z-index: ", ";\n      text-align: center;\n    "], ["\n      position: fixed;\n      top: 0;\n      right: 0;\n      bottom: 0;\n      left: 0;\n      background: #202226;\n      opacity: 0.7;\n      z-index: ", ";\n      text-align: center;\n    "])), theme.zIndex.modalBackdrop),
    };
};
var stopPropagation = function (event) { return event.stopPropagation(); };
function TimePickerCalendar(props) {
    var theme = useTheme2();
    var styles = getStyles(theme, props.isReversed);
    var isOpen = props.isOpen, isFullscreen = props.isFullscreen, onClose = props.onClose;
    var ref = React.createRef();
    var overlayProps = useOverlay({
        isDismissable: true,
        isOpen: isOpen,
        onClose: onClose,
    }, ref).overlayProps;
    if (!isOpen) {
        return null;
    }
    if (isFullscreen) {
        return (React.createElement(FocusScope, { contain: true, restoreFocus: true, autoFocus: true },
            React.createElement("section", __assign({ className: styles.container, onClick: stopPropagation, "aria-label": selectors.components.TimePicker.calendar.label, ref: ref }, overlayProps),
                React.createElement(Header, __assign({}, props)),
                React.createElement(Body, __assign({}, props)))));
    }
    return (React.createElement(Portal, null,
        React.createElement(FocusScope, { contain: true, autoFocus: true, restoreFocus: true },
            React.createElement("section", __assign({ className: styles.modal, onClick: stopPropagation, ref: ref }, overlayProps),
                React.createElement("div", { className: styles.content, "aria-label": selectors.components.TimePicker.calendar.label },
                    React.createElement(Header, __assign({}, props)),
                    React.createElement(Body, __assign({}, props)),
                    React.createElement(Footer, __assign({}, props))))),
        React.createElement("div", { className: styles.backdrop, onClick: stopPropagation })));
}
export default memo(TimePickerCalendar);
TimePickerCalendar.displayName = 'TimePickerCalendar';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=TimePickerCalendar.js.map
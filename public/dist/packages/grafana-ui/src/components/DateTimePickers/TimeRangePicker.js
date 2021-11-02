import { __assign, __makeTemplateObject, __read } from "tslib";
// Libraries
import React, { memo, createRef, useState } from 'react';
import { css } from '@emotion/css';
// Components
import { Tooltip } from '../Tooltip/Tooltip';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
// Utils & Services
import { stylesFactory } from '../../themes/stylesFactory';
import { withTheme, useTheme } from '../../themes/ThemeContext';
// Types
import { isDateTime, rangeUtil, dateTimeFormat, timeZoneFormatUserFriendly, dateMath, } from '@grafana/data';
import { quickOptions } from './options';
import { ButtonGroup, ToolbarButton } from '../Button';
import { selectors } from '@grafana/e2e-selectors';
import { useOverlay } from '@react-aria/overlays';
import { FocusScope } from '@react-aria/focus';
export function UnthemedTimeRangePicker(props) {
    var _a = __read(useState(false), 2), isOpen = _a[0], setOpen = _a[1];
    var value = props.value, onMoveBackward = props.onMoveBackward, onMoveForward = props.onMoveForward, onZoom = props.onZoom, timeZone = props.timeZone, fiscalYearStartMonth = props.fiscalYearStartMonth, timeSyncButton = props.timeSyncButton, isSynced = props.isSynced, theme = props.theme, history = props.history, onChangeTimeZone = props.onChangeTimeZone, onChangeFiscalYearStartMonth = props.onChangeFiscalYearStartMonth, hideQuickRanges = props.hideQuickRanges;
    var onChange = function (timeRange) {
        props.onChange(timeRange);
        setOpen(false);
    };
    var onOpen = function (event) {
        event.stopPropagation();
        event.preventDefault();
        setOpen(!isOpen);
    };
    var onClose = function () {
        setOpen(false);
    };
    var ref = createRef();
    var overlayProps = useOverlay({ onClose: onClose, isDismissable: true, isOpen: isOpen }, ref).overlayProps;
    var styles = getStyles(theme);
    var hasAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);
    var variant = isSynced ? 'active' : 'default';
    return (React.createElement(ButtonGroup, { className: styles.container },
        hasAbsolute && (React.createElement(ToolbarButton, { "aria-label": "Move time range backwards", variant: variant, onClick: onMoveBackward, icon: "angle-left", narrow: true })),
        React.createElement(Tooltip, { content: React.createElement(TimePickerTooltip, { timeRange: value, timeZone: timeZone }), placement: "bottom" },
            React.createElement(ToolbarButton, { "data-testid": selectors.components.TimePicker.openButton, "aria-label": "Time range picker with current time range " + formattedRange(value, timeZone) + " selected", "aria-controls": "TimePickerContent", onClick: onOpen, icon: "clock-nine", isOpen: isOpen, variant: variant },
                React.createElement(TimePickerButtonLabel, __assign({}, props)))),
        isOpen && (React.createElement(FocusScope, { contain: true, autoFocus: true, restoreFocus: true },
            React.createElement("section", __assign({ ref: ref }, overlayProps),
                React.createElement(TimePickerContent, { timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth, value: value, onChange: onChange, quickOptions: quickOptions, history: history, showHistory: true, onChangeTimeZone: onChangeTimeZone, onChangeFiscalYearStartMonth: onChangeFiscalYearStartMonth, hideQuickRanges: hideQuickRanges })))),
        timeSyncButton,
        hasAbsolute && (React.createElement(ToolbarButton, { "aria-label": "Move time range forwards", onClick: onMoveForward, icon: "angle-right", narrow: true, variant: variant })),
        React.createElement(Tooltip, { content: ZoomOutTooltip, placement: "bottom" },
            React.createElement(ToolbarButton, { "aria-label": "Zoom out time range", onClick: onZoom, icon: "search-minus", variant: variant }))));
}
var ZoomOutTooltip = function () { return (React.createElement(React.Fragment, null,
    "Time range zoom out ",
    React.createElement("br", null),
    " CTRL+Z")); };
var TimePickerTooltip = function (_a) {
    var timeRange = _a.timeRange, timeZone = _a.timeZone;
    var theme = useTheme();
    var styles = getLabelStyles(theme);
    return (React.createElement(React.Fragment, null,
        dateTimeFormat(timeRange.from, { timeZone: timeZone }),
        React.createElement("div", { className: "text-center" }, "to"),
        dateTimeFormat(timeRange.to, { timeZone: timeZone }),
        React.createElement("div", { className: "text-center" },
            React.createElement("span", { className: styles.utc }, timeZoneFormatUserFriendly(timeZone)))));
};
export var TimePickerButtonLabel = memo(function (_a) {
    var hideText = _a.hideText, value = _a.value, timeZone = _a.timeZone;
    var theme = useTheme();
    var styles = getLabelStyles(theme);
    if (hideText) {
        return null;
    }
    return (React.createElement("span", { className: styles.container },
        React.createElement("span", null, formattedRange(value, timeZone)),
        React.createElement("span", { className: styles.utc }, rangeUtil.describeTimeRangeAbbreviation(value, timeZone))));
});
TimePickerButtonLabel.displayName = 'TimePickerButtonLabel';
var formattedRange = function (value, timeZone) {
    var adjustedTimeRange = {
        to: dateMath.isMathString(value.raw.to) ? value.raw.to : value.to,
        from: dateMath.isMathString(value.raw.from) ? value.raw.from : value.from,
    };
    return rangeUtil.describeTimeRange(adjustedTimeRange, timeZone);
};
/** @public */
export var TimeRangePicker = withTheme(UnthemedTimeRangePicker);
var getStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n      display: flex;\n      vertical-align: middle;\n    "], ["\n      position: relative;\n      display: flex;\n      vertical-align: middle;\n    "]))),
    };
});
var getLabelStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      white-space: nowrap;\n    "], ["\n      display: flex;\n      align-items: center;\n      white-space: nowrap;\n    "]))),
        utc: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      color: ", ";\n      font-size: ", ";\n      padding-left: 6px;\n      line-height: 28px;\n      vertical-align: bottom;\n      font-weight: ", ";\n    "], ["\n      color: ", ";\n      font-size: ", ";\n      padding-left: 6px;\n      line-height: 28px;\n      vertical-align: bottom;\n      font-weight: ", ";\n    "])), theme.palette.orange, theme.typography.size.sm, theme.typography.weight.semibold),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=TimeRangePicker.js.map
import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { useMedia } from 'react-use';
import Calendar from 'react-calendar';
import { css, cx } from '@emotion/css';
import { dateTimeFormat, dateTime, isDateTime } from '@grafana/data';
import { Button, ClickOutsideWrapper, HorizontalGroup, Icon, InlineField, Input, Portal } from '../..';
import { TimeOfDayPicker } from '../TimeOfDayPicker';
import { getStyles as getCalendarStyles } from '../TimeRangePicker/TimePickerCalendar';
import { useStyles2, useTheme2 } from '../../../themes';
import { isValid } from '../utils';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';
var stopPropagation = function (event) { return event.stopPropagation(); };
export var DateTimePicker = function (_a) {
    var date = _a.date, maxDate = _a.maxDate, label = _a.label, onChange = _a.onChange;
    var _b = __read(useState(false), 2), isOpen = _b[0], setOpen = _b[1];
    var theme = useTheme2();
    var isFullscreen = useMedia("(min-width: " + theme.breakpoints.values.lg + "px)");
    var containerStyles = useStyles2(getCalendarStyles);
    var styles = useStyles2(getStyles);
    var onApply = useCallback(function (date) {
        setOpen(false);
        onChange(date);
    }, [onChange]);
    var onOpen = useCallback(function (event) {
        event.preventDefault();
        setOpen(true);
    }, [setOpen]);
    return (React.createElement("div", { "data-testid": "date-time-picker", style: { position: 'relative' } },
        React.createElement(DateTimeInput, { date: date, onChange: onChange, isFullscreen: isFullscreen, onOpen: onOpen, label: label }),
        isOpen ? (isFullscreen ? (React.createElement(ClickOutsideWrapper, { onClick: function () { return setOpen(false); } },
            React.createElement(DateTimeCalendar, { date: date, onChange: onApply, isFullscreen: true, onClose: function () { return setOpen(false); }, maxDate: maxDate }))) : (React.createElement(Portal, null,
            React.createElement(ClickOutsideWrapper, { onClick: function () { return setOpen(false); } },
                React.createElement("div", { className: styles.modal, onClick: stopPropagation },
                    React.createElement(DateTimeCalendar, { date: date, onChange: onApply, isFullscreen: false, onClose: function () { return setOpen(false); } })),
                React.createElement("div", { className: containerStyles.backdrop, onClick: stopPropagation }))))) : null));
};
var DateTimeInput = function (_a) {
    var date = _a.date, label = _a.label, onChange = _a.onChange, isFullscreen = _a.isFullscreen, onOpen = _a.onOpen;
    var _b = __read(useState(function () {
        return { value: date ? dateTimeFormat(date) : dateTimeFormat(dateTime()), invalid: false };
    }), 2), internalDate = _b[0], setInternalDate = _b[1];
    useEffect(function () {
        if (date) {
            setInternalDate({
                invalid: !isValid(dateTimeFormat(date)),
                value: isDateTime(date) ? dateTimeFormat(date) : date,
            });
        }
    }, [date]);
    var onChangeDate = useCallback(function (event) {
        var isInvalid = !isValid(event.currentTarget.value);
        setInternalDate({
            value: event.currentTarget.value,
            invalid: isInvalid,
        });
    }, []);
    var onFocus = useCallback(function (event) {
        if (!isFullscreen) {
            return;
        }
        onOpen(event);
    }, [isFullscreen, onOpen]);
    var onBlur = useCallback(function () {
        if (isDateTime(internalDate.value)) {
            onChange(dateTime(internalDate.value));
        }
    }, [internalDate.value, onChange]);
    var icon = React.createElement(Button, { icon: "calendar-alt", variant: "secondary", onClick: onOpen });
    return (React.createElement(InlineField, { label: label, onClick: stopPropagation, invalid: !!(internalDate.value && internalDate.invalid), className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        margin-bottom: 0;\n      "], ["\n        margin-bottom: 0;\n      "]))) },
        React.createElement(Input, { onClick: stopPropagation, onChange: onChangeDate, addonAfter: icon, value: internalDate.value, onFocus: onFocus, onBlur: onBlur, "data-testid": "date-time-input", placeholder: "Select date/time" })));
};
var DateTimeCalendar = function (_a) {
    var _b;
    var date = _a.date, onClose = _a.onClose, onChange = _a.onChange, isFullscreen = _a.isFullscreen, maxDate = _a.maxDate;
    var calendarStyles = useStyles2(getBodyStyles);
    var styles = useStyles2(getStyles);
    var _c = __read(useState(function () {
        if (date && date.isValid()) {
            return date.toDate();
        }
        return new Date();
    }), 2), internalDate = _c[0], setInternalDate = _c[1];
    var onChangeDate = useCallback(function (date) {
        if (!Array.isArray(date)) {
            setInternalDate(function (prevState) {
                // If we don't use time from prevState
                // the time will be reset to 00:00:00
                date.setHours(prevState.getHours());
                date.setMinutes(prevState.getMinutes());
                date.setSeconds(prevState.getSeconds());
                return date;
            });
        }
    }, []);
    var onChangeTime = useCallback(function (date) {
        setInternalDate(date.toDate());
    }, []);
    return (React.createElement("div", { className: cx(styles.container, (_b = {}, _b[styles.fullScreen] = isFullscreen, _b)), onClick: stopPropagation },
        React.createElement(Calendar, { next2Label: null, prev2Label: null, value: internalDate, nextLabel: React.createElement(Icon, { name: "angle-right" }), prevLabel: React.createElement(Icon, { name: "angle-left" }), onChange: onChangeDate, locale: "en", className: calendarStyles.body, tileClassName: calendarStyles.title, maxDate: maxDate }),
        React.createElement("div", { className: styles.time },
            React.createElement(TimeOfDayPicker, { showSeconds: true, onChange: onChangeTime, value: dateTime(internalDate) })),
        React.createElement(HorizontalGroup, null,
            React.createElement(Button, { type: "button", onClick: function () { return onChange(dateTime(internalDate)); } }, "Apply"),
            React.createElement(Button, { variant: "secondary", type: "button", onClick: onClose }, "Cancel"))));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding: ", ";\n    border: 1px ", " solid;\n    border-radius: ", ";\n    background-color: ", ";\n    z-index: ", ";\n  "], ["\n    padding: ", ";\n    border: 1px ", " solid;\n    border-radius: ", ";\n    background-color: ", ";\n    z-index: ", ";\n  "])), theme.spacing(1), theme.colors.border.weak, theme.shape.borderRadius(1), theme.colors.background.primary, theme.zIndex.modal),
    fullScreen: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    position: absolute;\n  "], ["\n    position: absolute;\n  "]))),
    time: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(2)),
    modal: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    position: fixed;\n    top: 25%;\n    left: 25%;\n    width: 100%;\n    z-index: ", ";\n    max-width: 280px;\n  "], ["\n    position: fixed;\n    top: 25%;\n    left: 25%;\n    width: 100%;\n    z-index: ", ";\n    max-width: 280px;\n  "])), theme.zIndex.modal),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=DateTimePicker.js.map
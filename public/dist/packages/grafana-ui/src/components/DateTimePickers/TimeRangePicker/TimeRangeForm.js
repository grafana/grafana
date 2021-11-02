import { __makeTemplateObject, __read } from "tslib";
import { css } from '@emotion/css';
import { dateMath, dateTimeFormat, dateTimeParse, isDateTime, rangeUtil, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import React, { useCallback, useEffect, useState } from 'react';
import { Icon, Tooltip } from '../..';
import { useStyles2 } from '../../..';
import { Button } from '../../Button';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';
import TimePickerCalendar from './TimePickerCalendar';
var ERROR_MESSAGES = {
    default: 'Please enter a past date or "now"',
    range: '"From" can\'t be after "To"',
};
export var TimeRangeForm = function (props) {
    var value = props.value, _a = props.isFullscreen, isFullscreen = _a === void 0 ? false : _a, timeZone = props.timeZone, onApplyFromProps = props.onApply, isReversed = props.isReversed, fiscalYearStartMonth = props.fiscalYearStartMonth;
    var _b = __read(valueToState(value.raw.from, value.raw.to, timeZone), 2), fromValue = _b[0], toValue = _b[1];
    var style = useStyles2(getStyles);
    var _c = __read(useState(fromValue), 2), from = _c[0], setFrom = _c[1];
    var _d = __read(useState(toValue), 2), to = _d[0], setTo = _d[1];
    var _e = __read(useState(false), 2), isOpen = _e[0], setOpen = _e[1];
    // Synchronize internal state with external value
    useEffect(function () {
        var _a = __read(valueToState(value.raw.from, value.raw.to, timeZone), 2), fromValue = _a[0], toValue = _a[1];
        setFrom(fromValue);
        setTo(toValue);
    }, [value.raw.from, value.raw.to, timeZone]);
    var onOpen = useCallback(function (event) {
        event.preventDefault();
        setOpen(true);
    }, [setOpen]);
    var onApply = useCallback(function (e) {
        e.preventDefault();
        if (to.invalid || from.invalid) {
            return;
        }
        var raw = { from: from.value, to: to.value };
        var timeRange = rangeUtil.convertRawToRange(raw, timeZone, fiscalYearStartMonth);
        onApplyFromProps(timeRange);
    }, [from.invalid, from.value, onApplyFromProps, timeZone, to.invalid, to.value, fiscalYearStartMonth]);
    var onChange = useCallback(function (from, to) {
        var _a = __read(valueToState(from, to, timeZone), 2), fromValue = _a[0], toValue = _a[1];
        setFrom(fromValue);
        setTo(toValue);
    }, [timeZone]);
    var fiscalYear = rangeUtil.convertRawToRange({ from: 'now/fy', to: 'now/fy' }, timeZone, fiscalYearStartMonth);
    var fyTooltip = (React.createElement("div", { className: style.tooltip }, rangeUtil.isFiscal(value) ? (React.createElement(Tooltip, { content: "Fiscal year: " + fiscalYear.from.format('MMM-DD') + " - " + fiscalYear.to.format('MMM-DD') },
        React.createElement(Icon, { name: "info-circle" }))) : null));
    var icon = (React.createElement(Button, { "aria-label": selectors.components.TimePicker.calendar.openButton, icon: "calendar-alt", variant: "secondary", onClick: onOpen }));
    return (React.createElement("div", null,
        React.createElement("div", { className: style.fieldContainer },
            React.createElement(Field, { label: "From", invalid: from.invalid, error: from.errorMessage },
                React.createElement(Input, { onClick: function (event) { return event.stopPropagation(); }, onChange: function (event) { return onChange(event.currentTarget.value, to.value); }, addonAfter: icon, "aria-label": selectors.components.TimePicker.fromField, value: from.value })),
            fyTooltip),
        React.createElement("div", { className: style.fieldContainer },
            React.createElement(Field, { label: "To", invalid: to.invalid, error: to.errorMessage },
                React.createElement(Input, { onClick: function (event) { return event.stopPropagation(); }, onChange: function (event) { return onChange(from.value, event.currentTarget.value); }, addonAfter: icon, "aria-label": selectors.components.TimePicker.toField, value: to.value })),
            fyTooltip),
        React.createElement(Button, { "data-testid": selectors.components.TimePicker.applyTimeRange, onClick: onApply }, "Apply time range"),
        React.createElement(TimePickerCalendar, { isFullscreen: isFullscreen, isOpen: isOpen, from: dateTimeParse(from.value), to: dateTimeParse(to.value), onApply: onApply, onClose: function () { return setOpen(false); }, onChange: onChange, timeZone: timeZone, isReversed: isReversed })));
};
function isRangeInvalid(from, to, timezone) {
    var raw = { from: from, to: to };
    var timeRange = rangeUtil.convertRawToRange(raw, timezone);
    var valid = timeRange.from.isSame(timeRange.to) || timeRange.from.isBefore(timeRange.to);
    return !valid;
}
function valueToState(rawFrom, rawTo, timeZone) {
    var fromValue = valueAsString(rawFrom, timeZone);
    var toValue = valueAsString(rawTo, timeZone);
    var fromInvalid = !isValid(fromValue, false, timeZone);
    var toInvalid = !isValid(toValue, true, timeZone);
    // If "To" is invalid, we should not check the range anyways
    var rangeInvalid = isRangeInvalid(fromValue, toValue, timeZone) && !toInvalid;
    return [
        {
            value: fromValue,
            invalid: fromInvalid || rangeInvalid,
            errorMessage: rangeInvalid && !fromInvalid ? ERROR_MESSAGES.range : ERROR_MESSAGES.default,
        },
        { value: toValue, invalid: toInvalid, errorMessage: ERROR_MESSAGES.default },
    ];
}
function valueAsString(value, timeZone) {
    if (isDateTime(value)) {
        return dateTimeFormat(value, { timeZone: timeZone });
    }
    return value;
}
function isValid(value, roundUp, timeZone) {
    if (isDateTime(value)) {
        return value.isValid();
    }
    if (dateMath.isMathString(value)) {
        return dateMath.isValid(value);
    }
    var parsed = dateTimeParse(value, { roundUp: roundUp, timeZone: timeZone });
    return parsed.isValid();
}
function getStyles(theme) {
    return {
        fieldContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        tooltip: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding-left: ", ";\n      padding-top: ", ";\n    "], ["\n      padding-left: ", ";\n      padding-top: ", ";\n    "])), theme.spacing(1), theme.spacing(3)),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=TimeRangeForm.js.map
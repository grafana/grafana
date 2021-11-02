import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { useStyles2 } from '../../../themes';
import Calendar from 'react-calendar';
import { css } from '@emotion/css';
import { Icon } from '../../Icon/Icon';
import { dateTime, dateTimeParse } from '@grafana/data';
export function Body(_a) {
    var onChange = _a.onChange, from = _a.from, to = _a.to, timeZone = _a.timeZone;
    var value = inputToValue(from, to);
    var onCalendarChange = useOnCalendarChange(onChange, timeZone);
    var styles = useStyles2(getBodyStyles);
    return (React.createElement(Calendar, { selectRange: true, next2Label: null, prev2Label: null, className: styles.body, tileClassName: styles.title, value: value, nextLabel: React.createElement(Icon, { name: "angle-right" }), prevLabel: React.createElement(Icon, { name: "angle-left" }), onChange: onCalendarChange, locale: "en" }));
}
Body.displayName = 'Body';
export function inputToValue(from, to, invalidDateDefault) {
    if (invalidDateDefault === void 0) { invalidDateDefault = new Date(); }
    var fromAsDate = from.toDate();
    var toAsDate = to.toDate();
    var fromAsValidDate = dateTime(fromAsDate).isValid() ? fromAsDate : invalidDateDefault;
    var toAsValidDate = dateTime(toAsDate).isValid() ? toAsDate : invalidDateDefault;
    if (fromAsValidDate > toAsValidDate) {
        return [toAsValidDate, fromAsValidDate];
    }
    return [fromAsValidDate, toAsValidDate];
}
function useOnCalendarChange(onChange, timeZone) {
    return useCallback(function (value) {
        if (!Array.isArray(value)) {
            return console.error('onCalendarChange: should be run in selectRange={true}');
        }
        var from = dateTimeParse(dateInfo(value[0]), { timeZone: timeZone });
        var to = dateTimeParse(dateInfo(value[1]), { timeZone: timeZone });
        onChange(from, to);
    }, [onChange, timeZone]);
}
function dateInfo(date) {
    return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
}
export var getBodyStyles = function (theme) {
    return {
        title: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n      background-color: ", ";\n      font-size: ", ";\n      border: 1px solid transparent;\n\n      &:hover {\n        position: relative;\n      }\n    "], ["\n      color: ", ";\n      background-color: ", ";\n      font-size: ", ";\n      border: 1px solid transparent;\n\n      &:hover {\n        position: relative;\n      }\n    "])), theme.colors.text, theme.colors.background.primary, theme.typography.size.md),
        body: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      z-index: ", ";\n      background-color: ", ";\n      width: 268px;\n\n      .react-calendar__navigation__label,\n      .react-calendar__navigation__arrow,\n      .react-calendar__navigation {\n        padding-top: 4px;\n        background-color: inherit;\n        color: ", ";\n        border: 0;\n        font-weight: ", ";\n      }\n\n      .react-calendar__month-view__weekdays {\n        background-color: inherit;\n        text-align: center;\n        color: ", ";\n\n        abbr {\n          border: 0;\n          text-decoration: none;\n          cursor: default;\n          display: block;\n          padding: 4px 0 4px 0;\n        }\n      }\n\n      .react-calendar__month-view__days {\n        background-color: inherit;\n      }\n\n      .react-calendar__tile,\n      .react-calendar__tile--now {\n        margin-bottom: 4px;\n        background-color: inherit;\n        height: 26px;\n      }\n\n      .react-calendar__navigation__label,\n      .react-calendar__navigation > button:focus,\n      .time-picker-calendar-tile:focus {\n        outline: 0;\n      }\n\n      .react-calendar__tile--active,\n      .react-calendar__tile--active:hover {\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n        box-shadow: none;\n        border: 0px;\n      }\n\n      .react-calendar__tile--rangeEnd,\n      .react-calendar__tile--rangeStart {\n        padding: 0;\n        border: 0px;\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n\n        abbr {\n          background-color: ", ";\n          border-radius: 100px;\n          display: block;\n          padding-top: 2px;\n          height: 26px;\n        }\n      }\n\n      .react-calendar__tile--rangeStart {\n        border-top-left-radius: 20px;\n        border-bottom-left-radius: 20px;\n      }\n\n      .react-calendar__tile--rangeEnd {\n        border-top-right-radius: 20px;\n        border-bottom-right-radius: 20px;\n      }\n    "], ["\n      z-index: ", ";\n      background-color: ", ";\n      width: 268px;\n\n      .react-calendar__navigation__label,\n      .react-calendar__navigation__arrow,\n      .react-calendar__navigation {\n        padding-top: 4px;\n        background-color: inherit;\n        color: ", ";\n        border: 0;\n        font-weight: ", ";\n      }\n\n      .react-calendar__month-view__weekdays {\n        background-color: inherit;\n        text-align: center;\n        color: ", ";\n\n        abbr {\n          border: 0;\n          text-decoration: none;\n          cursor: default;\n          display: block;\n          padding: 4px 0 4px 0;\n        }\n      }\n\n      .react-calendar__month-view__days {\n        background-color: inherit;\n      }\n\n      .react-calendar__tile,\n      .react-calendar__tile--now {\n        margin-bottom: 4px;\n        background-color: inherit;\n        height: 26px;\n      }\n\n      .react-calendar__navigation__label,\n      .react-calendar__navigation > button:focus,\n      .time-picker-calendar-tile:focus {\n        outline: 0;\n      }\n\n      .react-calendar__tile--active,\n      .react-calendar__tile--active:hover {\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n        box-shadow: none;\n        border: 0px;\n      }\n\n      .react-calendar__tile--rangeEnd,\n      .react-calendar__tile--rangeStart {\n        padding: 0;\n        border: 0px;\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n\n        abbr {\n          background-color: ", ";\n          border-radius: 100px;\n          display: block;\n          padding-top: 2px;\n          height: 26px;\n        }\n      }\n\n      .react-calendar__tile--rangeStart {\n        border-top-left-radius: 20px;\n        border-bottom-left-radius: 20px;\n      }\n\n      .react-calendar__tile--rangeEnd {\n        border-top-right-radius: 20px;\n        border-bottom-right-radius: 20px;\n      }\n    "])), theme.zIndex.modal, theme.colors.background.primary, theme.colors.text, theme.typography.fontWeightMedium, theme.colors.primary.text, theme.colors.primary.contrastText, theme.typography.fontWeightMedium, theme.colors.primary.main, theme.colors.primary.contrastText, theme.typography.fontWeightMedium, theme.colors.primary.main, theme.colors.primary.main),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=CalendarBody.js.map
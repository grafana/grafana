import { __makeTemplateObject, __read } from "tslib";
import React, { useState, useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { getTimeZoneInfo } from '@grafana/data';
import { stylesFactory, useTheme2 } from '../../../themes';
import { TimeZoneTitle } from '../TimeZonePicker/TimeZoneTitle';
import { TimeZoneDescription } from '../TimeZonePicker/TimeZoneDescription';
import { TimeZoneOffset } from '../TimeZonePicker/TimeZoneOffset';
import { Button } from '../../Button';
import { TimeZonePicker } from '../TimeZonePicker';
import { isString } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
import { Field, RadioButtonGroup, Select } from '../..';
import { monthOptions } from '../options';
export var TimePickerFooter = function (props) {
    var timeZone = props.timeZone, fiscalYearStartMonth = props.fiscalYearStartMonth, _a = props.timestamp, timestamp = _a === void 0 ? Date.now() : _a, onChangeTimeZone = props.onChangeTimeZone, onChangeFiscalYearStartMonth = props.onChangeFiscalYearStartMonth;
    var _b = __read(useState(false), 2), isEditing = _b[0], setEditing = _b[1];
    var _c = __read(useState('tz'), 2), editMode = _c[0], setEditMode = _c[1];
    var onToggleChangeTimeSettings = useCallback(function (event) {
        if (event) {
            event.stopPropagation();
        }
        setEditing(!isEditing);
    }, [isEditing, setEditing]);
    var theme = useTheme2();
    var style = getStyle(theme);
    if (!isString(timeZone)) {
        return null;
    }
    var info = getTimeZoneInfo(timeZone, timestamp);
    if (!info) {
        return null;
    }
    return (React.createElement("div", null,
        React.createElement("section", { "aria-label": "Time zone selection", className: style.container },
            React.createElement("div", { className: style.timeZoneContainer },
                React.createElement("div", { className: style.timeZone },
                    React.createElement(TimeZoneTitle, { title: info.name }),
                    React.createElement("div", { className: style.spacer }),
                    React.createElement(TimeZoneDescription, { info: info })),
                React.createElement(TimeZoneOffset, { timeZone: timeZone, timestamp: timestamp })),
            React.createElement("div", { className: style.spacer }),
            React.createElement(Button, { variant: "secondary", onClick: onToggleChangeTimeSettings, size: "sm" }, "Change time settings")),
        isEditing ? (React.createElement("div", { className: style.editContainer },
            React.createElement("div", null,
                React.createElement(RadioButtonGroup, { value: editMode, options: [
                        { label: 'Time Zone', value: 'tz' },
                        { label: 'Fiscal year', value: 'fy' },
                    ], onChange: setEditMode })),
            editMode === 'tz' ? (React.createElement("section", { "aria-label": selectors.components.TimeZonePicker.container, className: cx(style.timeZoneContainer, style.timeSettingContainer) },
                React.createElement(TimeZonePicker, { includeInternal: true, onChange: function (timeZone) {
                        onToggleChangeTimeSettings();
                        if (isString(timeZone)) {
                            onChangeTimeZone(timeZone);
                        }
                    }, onBlur: onToggleChangeTimeSettings }))) : (React.createElement("section", { "aria-label": selectors.components.TimeZonePicker.container, className: cx(style.timeZoneContainer, style.timeSettingContainer) },
                React.createElement(Field, { className: style.fiscalYearField, label: 'Fiscal year start month' },
                    React.createElement(Select, { value: fiscalYearStartMonth, options: monthOptions, onChange: function (value) {
                            var _a;
                            if (onChangeFiscalYearStartMonth) {
                                onChangeFiscalYearStartMonth((_a = value.value) !== null && _a !== void 0 ? _a : 0);
                            }
                        } })))))) : null));
};
var getStyle = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-top: 1px solid ", ";\n      padding: 11px;\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n    "], ["\n      border-top: 1px solid ", ";\n      padding: 11px;\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n    "])), theme.colors.border.weak),
        editContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      border-top: 1px solid ", ";\n      padding: 11px;\n      justify-content: space-between;\n      align-items: center;\n      padding: 7px;\n    "], ["\n      border-top: 1px solid ", ";\n      padding: 11px;\n      justify-content: space-between;\n      align-items: center;\n      padding: 7px;\n    "])), theme.colors.border.weak),
        spacer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: 7px;\n    "], ["\n      margin-left: 7px;\n    "]))),
        timeSettingContainer: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      padding-top: ", ";\n    "], ["\n      padding-top: ", ";\n    "])), theme.spacing(1)),
        fiscalYearField: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-bottom: 0px;\n    "], ["\n      margin-bottom: 0px;\n    "]))),
        timeZoneContainer: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n      flex-grow: 1;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n      flex-grow: 1;\n    "]))),
        timeZone: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: baseline;\n      flex-grow: 1;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: baseline;\n      flex-grow: 1;\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=TimePickerFooter.js.map
import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { dateMath, dateTime, getDefaultTimeRange } from '@grafana/data';
import { useTheme2 } from '../../themes/ThemeContext';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { getInputStyles } from '../Input/Input';
import { TimePickerButtonLabel } from './TimeRangePicker';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { quickOptions } from './options';
import { selectors } from '@grafana/e2e-selectors';
import { stylesFactory } from '../../themes';
var isValidTimeRange = function (range) {
    return dateMath.isValid(range.from) && dateMath.isValid(range.to);
};
var noop = function () { };
export var TimeRangeInput = function (_a) {
    var value = _a.value, onChange = _a.onChange, _b = _a.onChangeTimeZone, onChangeTimeZone = _b === void 0 ? noop : _b, clearable = _a.clearable, _c = _a.hideTimeZone, hideTimeZone = _c === void 0 ? true : _c, _d = _a.timeZone, timeZone = _d === void 0 ? 'browser' : _d, _e = _a.placeholder, placeholder = _e === void 0 ? 'Select time range' : _e, _f = _a.isReversed, isReversed = _f === void 0 ? true : _f, _g = _a.hideQuickRanges, hideQuickRanges = _g === void 0 ? false : _g, _h = _a.disabled, disabled = _h === void 0 ? false : _h;
    var _j = __read(useState(false), 2), isOpen = _j[0], setIsOpen = _j[1];
    var theme = useTheme2();
    var styles = getStyles(theme, disabled);
    var onOpen = function (event) {
        event.stopPropagation();
        event.preventDefault();
        if (disabled) {
            return;
        }
        setIsOpen(!isOpen);
    };
    var onClose = function () {
        setIsOpen(false);
    };
    var onRangeChange = function (timeRange) {
        onClose();
        onChange(timeRange);
    };
    var onRangeClear = function (event) {
        event.stopPropagation();
        var from = dateTime(null);
        var to = dateTime(null);
        onChange({ from: from, to: to, raw: { from: from, to: to } });
    };
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { tabIndex: 0, className: styles.pickerInput, "aria-label": selectors.components.TimePicker.openButton, onClick: onOpen },
            isValidTimeRange(value) ? (React.createElement(TimePickerButtonLabel, { value: value, timeZone: timeZone })) : (React.createElement("span", { className: styles.placeholder }, placeholder)),
            !disabled && (React.createElement("span", { className: styles.caretIcon },
                isValidTimeRange(value) && clearable && (React.createElement(Icon, { className: styles.clearIcon, name: "times", size: "lg", onClick: onRangeClear })),
                React.createElement(Icon, { name: isOpen ? 'angle-up' : 'angle-down', size: "lg" })))),
        isOpen && (React.createElement(ClickOutsideWrapper, { includeButtonPress: false, onClick: onClose },
            React.createElement(TimePickerContent, { timeZone: timeZone, value: isValidTimeRange(value) ? value : getDefaultTimeRange(), onChange: onRangeChange, quickOptions: quickOptions, onChangeTimeZone: onChangeTimeZone, className: styles.content, hideTimeZone: hideTimeZone, isReversed: isReversed, hideQuickRanges: hideQuickRanges })))));
};
var getStyles = stylesFactory(function (theme, disabled) {
    if (disabled === void 0) { disabled = false; }
    var inputStyles = getInputStyles({ theme: theme, invalid: false });
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      position: relative;\n    "], ["\n      display: flex;\n      position: relative;\n    "]))),
        content: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-left: 0;\n    "], ["\n      margin-left: 0;\n    "]))),
        pickerInput: cx(inputStyles.input, disabled && inputStyles.inputDisabled, inputStyles.wrapper, css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        cursor: pointer;\n        padding-right: 0;\n        line-height: ", "px;\n      "], ["\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        cursor: pointer;\n        padding-right: 0;\n        line-height: ", "px;\n      "])), theme.v1.spacing.formInputHeight - 2)),
        caretIcon: cx(inputStyles.suffix, css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        position: relative;\n        top: -1px;\n        margin-left: ", ";\n      "], ["\n        position: relative;\n        top: -1px;\n        margin-left: ", ";\n      "])), theme.v1.spacing.xs)),
        clearIcon: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-right: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      margin-right: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.v1.spacing.xs, theme.v1.colors.linkHover),
        placeholder: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      color: ", ";\n      opacity: 1;\n    "], ["\n      color: ", ";\n      opacity: 1;\n    "])), theme.v1.colors.formInputPlaceholderText),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=TimeRangeInput.js.map
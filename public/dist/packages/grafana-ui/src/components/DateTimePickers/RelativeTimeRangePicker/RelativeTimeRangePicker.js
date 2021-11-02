import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../../themes';
import { Button } from '../../Button';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { TimeRangeList } from '../TimeRangePicker/TimeRangeList';
import { quickOptions } from '../options';
import CustomScrollbar from '../../CustomScrollbar/CustomScrollbar';
import { TimePickerTitle } from '../TimeRangePicker/TimePickerTitle';
import { isRangeValid, isRelativeFormat, mapOptionToRelativeTimeRange, mapRelativeTimeRangeToOption, } from './utils';
import { Field } from '../../Forms/Field';
import { getInputStyles, Input } from '../../Input/Input';
import { Icon } from '../../Icon/Icon';
var validOptions = quickOptions.filter(function (o) { return isRelativeFormat(o.from); });
/**
 * @internal
 */
export function RelativeTimeRangePicker(props) {
    var timeRange = props.timeRange, onChange = props.onChange;
    var _a = __read(useState(false), 2), isOpen = _a[0], setIsOpen = _a[1];
    var onClose = useCallback(function () { return setIsOpen(false); }, []);
    var timeOption = mapRelativeTimeRangeToOption(timeRange);
    var _b = __read(useState({ value: timeOption.from, validation: isRangeValid(timeOption.from) }), 2), from = _b[0], setFrom = _b[1];
    var _c = __read(useState({ value: timeOption.to, validation: isRangeValid(timeOption.to) }), 2), to = _c[0], setTo = _c[1];
    var styles = useStyles2(getStyles(from.validation.errorMessage, to.validation.errorMessage));
    var onChangeTimeOption = function (option) {
        var relativeTimeRange = mapOptionToRelativeTimeRange(option);
        if (!relativeTimeRange) {
            return;
        }
        onClose();
        setFrom(__assign(__assign({}, from), { value: option.from }));
        setTo(__assign(__assign({}, to), { value: option.to }));
        onChange(relativeTimeRange);
    };
    var onOpen = useCallback(function (event) {
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(!isOpen);
    }, [isOpen]);
    var onApply = function (event) {
        event.preventDefault();
        if (!to.validation.isValid || !from.validation.isValid) {
            return;
        }
        var timeRange = mapOptionToRelativeTimeRange({
            from: from.value,
            to: to.value,
            display: '',
        });
        if (!timeRange) {
            return;
        }
        onChange(timeRange);
        setIsOpen(false);
    };
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { tabIndex: 0, className: styles.pickerInput, onClick: onOpen },
            React.createElement("span", { className: styles.clockIcon },
                React.createElement(Icon, { name: "clock-nine" })),
            React.createElement("span", null,
                timeOption.from,
                " to ",
                timeOption.to),
            React.createElement("span", { className: styles.caretIcon },
                React.createElement(Icon, { name: isOpen ? 'angle-up' : 'angle-down', size: "lg" }))),
        isOpen && (React.createElement(ClickOutsideWrapper, { includeButtonPress: false, onClick: onClose },
            React.createElement("div", { className: styles.content },
                React.createElement("div", { className: styles.body },
                    React.createElement(CustomScrollbar, { className: styles.leftSide, hideHorizontalTrack: true },
                        React.createElement(TimeRangeList, { title: "Example time ranges", options: validOptions, onChange: onChangeTimeOption, value: timeOption })),
                    React.createElement("div", { className: styles.rightSide },
                        React.createElement("div", { className: styles.title },
                            React.createElement(TimePickerTitle, null, "Specify time range"),
                            React.createElement("div", { className: styles.description },
                                "Specify a relative time range, for more information see",
                                ' ',
                                React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/dashboards/time-range-controls/" },
                                    "docs ",
                                    React.createElement(Icon, { name: "external-link-alt" })),
                                ".")),
                        React.createElement(Field, { label: "From", invalid: !from.validation.isValid, error: from.validation.errorMessage },
                            React.createElement(Input, { onClick: function (event) { return event.stopPropagation(); }, onBlur: function () { return setFrom(__assign(__assign({}, from), { validation: isRangeValid(from.value) })); }, onChange: function (event) { return setFrom(__assign(__assign({}, from), { value: event.currentTarget.value })); }, value: from.value })),
                        React.createElement(Field, { label: "To", invalid: !to.validation.isValid, error: to.validation.errorMessage },
                            React.createElement(Input, { onClick: function (event) { return event.stopPropagation(); }, onBlur: function () { return setTo(__assign(__assign({}, to), { validation: isRangeValid(to.value) })); }, onChange: function (event) { return setTo(__assign(__assign({}, to), { value: event.currentTarget.value })); }, value: to.value })),
                        React.createElement(Button, { "aria-label": "TimePicker submit button", onClick: onApply }, "Apply time range"))))))));
}
var getStyles = function (fromError, toError) { return function (theme) {
    var inputStyles = getInputStyles({ theme: theme, invalid: false });
    var bodyMinimumHeight = 250;
    var bodyHeight = bodyMinimumHeight + calculateErrorHeight(theme, fromError) + calculateErrorHeight(theme, toError);
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      position: relative;\n    "], ["\n      display: flex;\n      position: relative;\n    "]))),
        pickerInput: cx(inputStyles.input, inputStyles.wrapper, css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        cursor: pointer;\n        padding-right: 0;\n        padding-left: 0;\n        line-height: ", "px;\n      "], ["\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        cursor: pointer;\n        padding-right: 0;\n        padding-left: 0;\n        line-height: ", "px;\n      "])), theme.v1.spacing.formInputHeight - 2)),
        caretIcon: cx(inputStyles.suffix, css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        position: relative;\n        margin-left: ", ";\n      "], ["\n        position: relative;\n        margin-left: ", ";\n      "])), theme.v1.spacing.xs)),
        clockIcon: cx(inputStyles.prefix, css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        position: relative;\n        margin-right: ", ";\n      "], ["\n        position: relative;\n        margin-right: ", ";\n      "])), theme.v1.spacing.xs)),
        content: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      background: ", ";\n      box-shadow: ", ";\n      position: absolute;\n      z-index: ", ";\n      width: 500px;\n      top: 100%;\n      border-radius: 2px;\n      border: 1px solid ", ";\n      left: 0;\n      white-space: normal;\n    "], ["\n      background: ", ";\n      box-shadow: ", ";\n      position: absolute;\n      z-index: ", ";\n      width: 500px;\n      top: 100%;\n      border-radius: 2px;\n      border: 1px solid ", ";\n      left: 0;\n      white-space: normal;\n    "])), theme.colors.background.primary, theme.shadows.z3, theme.zIndex.dropdown, theme.colors.border.weak),
        body: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      height: ", "px;\n    "], ["\n      display: flex;\n      height: ", "px;\n    "])), bodyHeight),
        description: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      color: ", ";\n      font-size: ", ";\n    "], ["\n      color: ", ";\n      font-size: ", ";\n    "])), theme.colors.text.secondary, theme.typography.size.sm),
        leftSide: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      width: 50% !important;\n      border-right: 1px solid ", ";\n    "], ["\n      width: 50% !important;\n      border-right: 1px solid ", ";\n    "])), theme.colors.border.medium),
        rightSide: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      width: 50%;\n      padding: ", ";\n    "], ["\n      width: 50%;\n      padding: ", ";\n    "])), theme.spacing(1)),
        title: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(1)),
    };
}; };
function calculateErrorHeight(theme, errorMessage) {
    if (!errorMessage) {
        return 0;
    }
    if (errorMessage.length > 34) {
        return theme.spacing.gridSize * 6.5;
    }
    return theme.spacing.gridSize * 4;
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=RelativeTimeRangePicker.js.map
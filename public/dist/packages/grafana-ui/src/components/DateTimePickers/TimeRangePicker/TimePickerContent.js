import { __assign, __makeTemplateObject, __read } from "tslib";
import { isDateTime, rangeUtil } from '@grafana/data';
import { css, cx } from '@emotion/css';
import React, { memo, useMemo, useState } from 'react';
import { useMedia } from 'react-use';
import { stylesFactory, useTheme2 } from '../../../themes';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import { Icon } from '../../Icon/Icon';
import { mapOptionToTimeRange, mapRangeToTimeOption } from './mapper';
import { TimePickerTitle } from './TimePickerTitle';
import { TimeRangeForm } from './TimeRangeForm';
import { TimeRangeList } from './TimeRangeList';
import { TimePickerFooter } from './TimePickerFooter';
import { getFocusStyles } from '../../../themes/mixins';
import { selectors } from '@grafana/e2e-selectors';
import { FilterInput } from '../..';
var getStyles = stylesFactory(function (theme, isReversed, hideQuickRanges, isContainerTall) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background: ", ";\n      box-shadow: ", ";\n      position: absolute;\n      z-index: ", ";\n      width: 546px;\n      top: 116%;\n      border-radius: 2px;\n      border: 1px solid ", ";\n      ", ": 0;\n\n      @media only screen and (max-width: ", "px) {\n        width: 262px;\n      }\n    "], ["\n      background: ", ";\n      box-shadow: ", ";\n      position: absolute;\n      z-index: ", ";\n      width: 546px;\n      top: 116%;\n      border-radius: 2px;\n      border: 1px solid ", ";\n      ", ": 0;\n\n      @media only screen and (max-width: ", "px) {\n        width: 262px;\n      }\n    "])), theme.colors.background.primary, theme.shadows.z3, theme.zIndex.dropdown, theme.colors.border.weak, isReversed ? 'left' : 'right', theme.breakpoints.values.lg),
        body: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row-reverse;\n      height: ", ";\n    "], ["\n      display: flex;\n      flex-direction: row-reverse;\n      height: ", ";\n    "])), isContainerTall ? '381px' : '217px'),
        leftSide: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      border-right: ", ";\n      width: ", ";\n      overflow: hidden;\n      order: ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      border-right: ", ";\n      width: ", ";\n      overflow: hidden;\n      order: ", ";\n    "])), isReversed ? 'none' : "1px solid " + theme.colors.border.weak, !hideQuickRanges ? '60%' : '100%', isReversed ? 1 : 0),
        rightSide: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 40% !important;\n      border-right: ", ";\n      display: flex;\n      flex-direction: column;\n      @media only screen and (max-width: ", "px) {\n        width: 100% !important;\n      }\n    "], ["\n      width: 40% !important;\n      border-right: ", ";\n      display: flex;\n      flex-direction: column;\n      @media only screen and (max-width: ", "px) {\n        width: 100% !important;\n      }\n    "])), isReversed ? "1px solid " + theme.colors.border.weak : 'none', theme.breakpoints.values.lg),
        timeRangeFilter: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(1)),
        spacing: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-top: 16px;\n    "], ["\n      margin-top: 16px;\n    "]))),
    };
});
var getNarrowScreenStyles = stylesFactory(function (theme) {
    return {
        header: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n      border-bottom: 1px solid ", ";\n      padding: 7px 9px 7px 9px;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n      border-bottom: 1px solid ", ";\n      padding: 7px 9px 7px 9px;\n    "])), theme.colors.border.weak),
        expandButton: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      background-color: transparent;\n      border: none;\n      display: flex;\n      width: 100%;\n\n      &:focus-visible {\n        ", "\n      }\n    "], ["\n      background-color: transparent;\n      border: none;\n      display: flex;\n      width: 100%;\n\n      &:focus-visible {\n        ", "\n      }\n    "])), getFocusStyles(theme)),
        body: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      border-bottom: 1px solid ", ";\n    "], ["\n      border-bottom: 1px solid ", ";\n    "])), theme.colors.border.weak),
        form: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      padding: 7px 9px 7px 9px;\n    "], ["\n      padding: 7px 9px 7px 9px;\n    "]))),
    };
});
var getFullScreenStyles = stylesFactory(function (theme, hideQuickRanges) {
    return {
        container: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      padding-top: 9px;\n      padding-left: 11px;\n      padding-right: ", ";\n    "], ["\n      padding-top: 9px;\n      padding-left: 11px;\n      padding-right: ", ";\n    "])), !hideQuickRanges ? '20%' : '11px'),
        title: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n      margin-bottom: 11px;\n    "], ["\n      margin-bottom: 11px;\n    "]))),
        recent: css(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n      flex-grow: 1;\n      display: flex;\n      flex-direction: column;\n      justify-content: flex-end;\n      padding-top: ", ";\n    "], ["\n      flex-grow: 1;\n      display: flex;\n      flex-direction: column;\n      justify-content: flex-end;\n      padding-top: ", ";\n    "])), theme.spacing(1)),
    };
});
var getEmptyListStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\n      padding: 12px;\n      margin: 12px;\n\n      a,\n      span {\n        font-size: 13px;\n      }\n    "], ["\n      padding: 12px;\n      margin: 12px;\n\n      a,\n      span {\n        font-size: 13px;\n      }\n    "]))),
        link: css(templateObject_15 || (templateObject_15 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.link),
    };
});
export var TimePickerContentWithScreenSize = function (props) {
    var _a = props.quickOptions, quickOptions = _a === void 0 ? [] : _a, isReversed = props.isReversed, isFullscreen = props.isFullscreen, hideQuickRanges = props.hideQuickRanges, timeZone = props.timeZone, fiscalYearStartMonth = props.fiscalYearStartMonth, value = props.value, onChange = props.onChange, history = props.history, showHistory = props.showHistory, className = props.className, hideTimeZone = props.hideTimeZone, onChangeTimeZone = props.onChangeTimeZone, onChangeFiscalYearStartMonth = props.onChangeFiscalYearStartMonth;
    var isHistoryEmpty = !(history === null || history === void 0 ? void 0 : history.length);
    var isContainerTall = (isFullscreen && showHistory) || (!isFullscreen && ((showHistory && !isHistoryEmpty) || !hideQuickRanges));
    var theme = useTheme2();
    var styles = getStyles(theme, isReversed, hideQuickRanges, isContainerTall);
    var historyOptions = mapToHistoryOptions(history, timeZone);
    var timeOption = useTimeOption(value.raw, quickOptions);
    var _b = __read(useState(''), 2), searchTerm = _b[0], setSearchQuery = _b[1];
    var filteredQuickOptions = quickOptions.filter(function (o) { return o.display.toLowerCase().includes(searchTerm.toLowerCase()); });
    var onChangeTimeOption = function (timeOption) {
        return onChange(mapOptionToTimeRange(timeOption));
    };
    return (React.createElement("div", { id: "TimePickerContent", className: cx(styles.container, className) },
        React.createElement("div", { className: styles.body },
            (!isFullscreen || !hideQuickRanges) && (React.createElement("div", { className: styles.rightSide },
                React.createElement("div", { className: styles.timeRangeFilter },
                    React.createElement(FilterInput, { width: 0, autoFocus: true, value: searchTerm, onChange: setSearchQuery, placeholder: 'Search quick ranges' })),
                React.createElement(CustomScrollbar, null,
                    !isFullscreen && React.createElement(NarrowScreenForm, __assign({}, props, { historyOptions: historyOptions })),
                    !hideQuickRanges && (React.createElement(TimeRangeList, { options: filteredQuickOptions, onChange: onChangeTimeOption, value: timeOption }))))),
            isFullscreen && (React.createElement("div", { className: styles.leftSide },
                React.createElement(FullScreenForm, __assign({}, props, { historyOptions: historyOptions }))))),
        !hideTimeZone && isFullscreen && (React.createElement(TimePickerFooter, { timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth, onChangeTimeZone: onChangeTimeZone, onChangeFiscalYearStartMonth: onChangeFiscalYearStartMonth }))));
};
export var TimePickerContent = function (props) {
    var theme = useTheme2();
    var isFullscreen = useMedia("(min-width: " + theme.breakpoints.values.lg + "px)");
    return React.createElement(TimePickerContentWithScreenSize, __assign({}, props, { isFullscreen: isFullscreen }));
};
var NarrowScreenForm = function (props) {
    var value = props.value, hideQuickRanges = props.hideQuickRanges, onChange = props.onChange, timeZone = props.timeZone, _a = props.historyOptions, historyOptions = _a === void 0 ? [] : _a, showHistory = props.showHistory;
    var theme = useTheme2();
    var styles = getNarrowScreenStyles(theme);
    var isAbsolute = isDateTime(value.raw.from) || isDateTime(value.raw.to);
    var _b = __read(useState(!isAbsolute), 2), collapsedFlag = _b[0], setCollapsedFlag = _b[1];
    var collapsed = hideQuickRanges ? false : collapsedFlag;
    var onChangeTimeOption = function (timeOption) {
        return onChange(mapOptionToTimeRange(timeOption));
    };
    return (React.createElement("fieldset", null,
        React.createElement("div", { className: styles.header },
            React.createElement("button", { className: styles.expandButton, onClick: function () {
                    if (!hideQuickRanges) {
                        setCollapsedFlag(!collapsed);
                    }
                }, "data-testid": selectors.components.TimePicker.absoluteTimeRangeTitle, "aria-expanded": !collapsed, "aria-controls": "expanded-timerange" },
                React.createElement(TimePickerTitle, null, "Absolute time range"),
                !hideQuickRanges && React.createElement(Icon, { name: !collapsed ? 'angle-up' : 'angle-down' }))),
        !collapsed && (React.createElement("div", { className: styles.body, id: "expanded-timerange" },
            React.createElement("div", { className: styles.form },
                React.createElement(TimeRangeForm, { value: value, onApply: onChange, timeZone: timeZone, isFullscreen: false })),
            showHistory && (React.createElement(TimeRangeList, { title: "Recently used absolute ranges", options: historyOptions, onChange: onChangeTimeOption, placeholderEmpty: null }))))));
};
var FullScreenForm = function (props) {
    var onChange = props.onChange, value = props.value, timeZone = props.timeZone, fiscalYearStartMonth = props.fiscalYearStartMonth, isReversed = props.isReversed, historyOptions = props.historyOptions;
    var theme = useTheme2();
    var styles = getFullScreenStyles(theme, props.hideQuickRanges);
    var onChangeTimeOption = function (timeOption) {
        return onChange(mapOptionToTimeRange(timeOption));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container },
            React.createElement("div", { className: styles.title, "data-testid": selectors.components.TimePicker.absoluteTimeRangeTitle },
                React.createElement(TimePickerTitle, null, "Absolute time range")),
            React.createElement(TimeRangeForm, { value: value, timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth, onApply: onChange, isFullscreen: true, isReversed: isReversed })),
        props.showHistory && (React.createElement("div", { className: styles.recent },
            React.createElement(TimeRangeList, { title: "Recently used absolute ranges", options: historyOptions || [], onChange: onChangeTimeOption, placeholderEmpty: React.createElement(EmptyRecentList, null) })))));
};
var EmptyRecentList = memo(function () {
    var theme = useTheme2();
    var styles = getEmptyListStyles(theme);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", null,
            React.createElement("span", null, "It looks like you haven't used this time picker before. As soon as you enter some time intervals, recently used intervals will appear here.")),
        React.createElement("div", null,
            React.createElement("a", { className: styles.link, href: "https://grafana.com/docs/grafana/latest/dashboards/time-range-controls", target: "_new" }, "Read the documentation"),
            React.createElement("span", null, " to find out more about how to enter custom time ranges."))));
});
function mapToHistoryOptions(ranges, timeZone) {
    if (!Array.isArray(ranges) || ranges.length === 0) {
        return [];
    }
    return ranges.slice(ranges.length - 4).map(function (range) { return mapRangeToTimeOption(range, timeZone); });
}
EmptyRecentList.displayName = 'EmptyRecentList';
var useTimeOption = function (raw, quickOptions) {
    return useMemo(function () {
        if (!rangeUtil.isRelativeTimeRange(raw)) {
            return;
        }
        return quickOptions.find(function (option) {
            return option.from === raw.from && option.to === raw.to;
        });
    }, [raw, quickOptions]);
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15;
//# sourceMappingURL=TimePickerContent.js.map
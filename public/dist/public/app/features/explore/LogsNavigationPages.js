import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from 'emotion';
import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import { CustomScrollbar, Spinner, useTheme2 } from '@grafana/ui';
export function LogsNavigationPages(_a) {
    var pages = _a.pages, currentPageIndex = _a.currentPageIndex, oldestLogsFirst = _a.oldestLogsFirst, timeZone = _a.timeZone, loading = _a.loading, changeTime = _a.changeTime;
    var formatTime = function (time) {
        return "" + dateTimeFormat(time, {
            format: systemDateFormats.interval.second,
            timeZone: timeZone,
        });
    };
    var createPageContent = function (page, index) {
        if (currentPageIndex === index && loading) {
            return React.createElement(Spinner, null);
        }
        var topContent = formatTime(oldestLogsFirst ? page.logsRange.from : page.logsRange.to);
        var bottomContent = formatTime(oldestLogsFirst ? page.logsRange.to : page.logsRange.from);
        return topContent + " \u2014 " + bottomContent;
    };
    var theme = useTheme2();
    var styles = getStyles(theme, loading);
    return (React.createElement(CustomScrollbar, { autoHide: true },
        React.createElement("div", { className: styles.pagesWrapper, "data-testid": "logsNavigationPages" },
            React.createElement("div", { className: styles.pagesContainer }, pages.map(function (page, index) { return (React.createElement("div", { "data-testid": "page" + (index + 1), className: styles.page, key: page.queryRange.to, onClick: function () { return !loading && changeTime({ from: page.queryRange.from, to: page.queryRange.to }); } },
                React.createElement("div", { className: cx(styles.line, { selectedBg: currentPageIndex === index }) }),
                React.createElement("div", { className: cx(styles.time, { selectedText: currentPageIndex === index }) }, createPageContent(page, index)))); })))));
}
var getStyles = function (theme, loading) {
    return {
        pagesWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 100%;\n      padding-left: ", ";\n      display: flex;\n      flex-direction: column;\n      overflow-y: scroll;\n      &::after {\n        content: '';\n        display: block;\n        background: repeating-linear-gradient(\n          135deg,\n          ", ",\n          ", " 5px,\n          ", " 5px,\n          ", " 15px\n        );\n        width: 3px;\n        height: inherit;\n        margin-bottom: 8px;\n      }\n    "], ["\n      height: 100%;\n      padding-left: ", ";\n      display: flex;\n      flex-direction: column;\n      overflow-y: scroll;\n      &::after {\n        content: '';\n        display: block;\n        background: repeating-linear-gradient(\n          135deg,\n          ", ",\n          ", " 5px,\n          ", " 5px,\n          ", " 15px\n        );\n        width: 3px;\n        height: inherit;\n        margin-bottom: 8px;\n      }\n    "])), theme.spacing(0.5), theme.colors.background.primary, theme.colors.background.primary, theme.colors.background.secondary, theme.colors.background.secondary),
        pagesContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      padding: 0;\n      flex-direction: column;\n    "], ["\n      display: flex;\n      padding: 0;\n      flex-direction: column;\n    "]))),
        page: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      margin: ", " 0;\n      cursor: ", ";\n      white-space: normal;\n      .selectedBg {\n        background: ", ";\n      }\n      .selectedText {\n        color: ", ";\n      }\n    "], ["\n      display: flex;\n      margin: ", " 0;\n      cursor: ", ";\n      white-space: normal;\n      .selectedBg {\n        background: ", ";\n      }\n      .selectedText {\n        color: ", ";\n      }\n    "])), theme.spacing(2), loading ? 'auto' : 'pointer', theme.colors.primary.main, theme.colors.primary.main),
        line: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 3px;\n      height: 100%;\n      align-items: center;\n      background: ", ";\n    "], ["\n      width: 3px;\n      height: 100%;\n      align-items: center;\n      background: ", ";\n    "])), theme.colors.text.secondary),
        time: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      width: 60px;\n      min-height: 80px;\n      font-size: ", ";\n      padding-left: ", ";\n      display: flex;\n      align-items: center;\n    "], ["\n      width: 60px;\n      min-height: 80px;\n      font-size: ", ";\n      padding-left: ", ";\n      display: flex;\n      align-items: center;\n    "])), theme.v1.typography.size.sm, theme.spacing(0.5)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=LogsNavigationPages.js.map
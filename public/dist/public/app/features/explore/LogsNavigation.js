import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { memo, useState, useEffect, useRef } from 'react';
import { isEqual } from 'lodash';
import { css } from 'emotion';
import { LogsSortOrder } from '@grafana/data';
import { Button, Icon, Spinner, useTheme2 } from '@grafana/ui';
import { LogsNavigationPages } from './LogsNavigationPages';
function LogsNavigation(_a) {
    var absoluteRange = _a.absoluteRange, logsSortOrder = _a.logsSortOrder, timeZone = _a.timeZone, loading = _a.loading, onChangeTime = _a.onChangeTime, scrollToTopLogs = _a.scrollToTopLogs, visibleRange = _a.visibleRange, queries = _a.queries, clearCache = _a.clearCache, addResultsToCache = _a.addResultsToCache;
    var _b = __read(useState([]), 2), pages = _b[0], setPages = _b[1];
    var _c = __read(useState(0), 2), currentPageIndex = _c[0], setCurrentPageIndex = _c[1];
    // These refs are to determine, if we want to clear up logs navigation when totally new query is run
    var expectedQueriesRef = useRef();
    var expectedRangeRef = useRef();
    // This ref is to store range span for future queres based on firstly selected time range
    // e.g. if last 5 min selected, always run 5 min range
    var rangeSpanRef = useRef(0);
    var oldestLogsFirst = logsSortOrder === LogsSortOrder.Ascending;
    var onFirstPage = currentPageIndex === 0;
    var onLastPage = currentPageIndex === pages.length - 1;
    var theme = useTheme2();
    var styles = getStyles(theme, oldestLogsFirst, loading);
    // Main effect to set pages and index
    useEffect(function () {
        var newPage = { logsRange: visibleRange, queryRange: absoluteRange };
        var newPages = [];
        // We want to start new pagination if queries change or if absolute range is different than expected
        if (!isEqual(expectedRangeRef.current, absoluteRange) || !isEqual(expectedQueriesRef.current, queries)) {
            clearCache();
            setPages([newPage]);
            setCurrentPageIndex(0);
            expectedQueriesRef.current = queries;
            rangeSpanRef.current = absoluteRange.to - absoluteRange.from;
        }
        else {
            setPages(function (pages) {
                // Remove duplicates with new query
                newPages = pages.filter(function (page) { return !isEqual(newPage.queryRange, page.queryRange); });
                // Sort pages based on logsOrder so they visually align with displayed logs
                newPages = __spreadArray(__spreadArray([], __read(newPages), false), [newPage], false).sort(function (a, b) { return sortPages(a, b, logsSortOrder); });
                // Set new pages
                return newPages;
            });
            // Set current page index
            var index = newPages.findIndex(function (page) { return page.queryRange.to === absoluteRange.to; });
            setCurrentPageIndex(index);
        }
        addResultsToCache();
    }, [visibleRange, absoluteRange, logsSortOrder, queries, clearCache, addResultsToCache]);
    useEffect(function () {
        return function () { return clearCache(); };
        // We can't enforce the eslint rule here because we only want to run when component unmounts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    var changeTime = function (_a) {
        var from = _a.from, to = _a.to;
        expectedRangeRef.current = { from: from, to: to };
        onChangeTime({ from: from, to: to });
    };
    var sortPages = function (a, b, logsSortOrder) {
        if (logsSortOrder === LogsSortOrder.Ascending) {
            return a.queryRange.to > b.queryRange.to ? 1 : -1;
        }
        return a.queryRange.to > b.queryRange.to ? -1 : 1;
    };
    var olderLogsButton = (React.createElement(Button, { "data-testid": "olderLogsButton", className: styles.navButton, variant: "secondary", onClick: function () {
            //If we are not on the last page, use next page's range
            if (!onLastPage) {
                changeTime({
                    from: pages[currentPageIndex + 1].queryRange.from,
                    to: pages[currentPageIndex + 1].queryRange.to,
                });
            }
            else {
                //If we are on the last page, create new range
                changeTime({ from: visibleRange.from - rangeSpanRef.current, to: visibleRange.from });
            }
        }, disabled: loading },
        React.createElement("div", { className: styles.navButtonContent },
            loading ? React.createElement(Spinner, null) : React.createElement(Icon, { name: oldestLogsFirst ? 'angle-up' : 'angle-down', size: "lg" }),
            "Older logs")));
    var newerLogsButton = (React.createElement(Button, { "data-testid": "newerLogsButton", className: styles.navButton, variant: "secondary", onClick: function () {
            //If we are not on the first page, use previous page's range
            if (!onFirstPage) {
                changeTime({
                    from: pages[currentPageIndex - 1].queryRange.from,
                    to: pages[currentPageIndex - 1].queryRange.to,
                });
            }
            //If we are on the first page, button is disabled and we do nothing
        }, disabled: loading || onFirstPage },
        React.createElement("div", { className: styles.navButtonContent },
            loading && React.createElement(Spinner, null),
            onFirstPage || loading ? null : React.createElement(Icon, { name: oldestLogsFirst ? 'angle-down' : 'angle-up', size: "lg" }),
            onFirstPage ? 'Start of range' : 'Newer logs')));
    return (React.createElement("div", { className: styles.navContainer },
        oldestLogsFirst ? olderLogsButton : newerLogsButton,
        React.createElement(LogsNavigationPages, { pages: pages, currentPageIndex: currentPageIndex, oldestLogsFirst: oldestLogsFirst, timeZone: timeZone, loading: loading, changeTime: changeTime }),
        oldestLogsFirst ? newerLogsButton : olderLogsButton,
        React.createElement(Button, { "data-testid": "scrollToTop", className: styles.scrollToTopButton, variant: "secondary", onClick: scrollToTopLogs, title: "Scroll to top" },
            React.createElement(Icon, { name: "arrow-up", size: "lg" }))));
}
export default memo(LogsNavigation);
var getStyles = function (theme, oldestLogsFirst, loading) {
    return {
        navContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      max-height: 95vh;\n      display: flex;\n      flex-direction: column;\n      justify-content: ", ";\n      position: sticky;\n      top: ", ";\n      right: 0;\n    "], ["\n      max-height: 95vh;\n      display: flex;\n      flex-direction: column;\n      justify-content: ", ";\n      position: sticky;\n      top: ", ";\n      right: 0;\n    "])), oldestLogsFirst ? 'flex-start' : 'space-between', theme.spacing(2)),
        navButton: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 58px;\n      height: 68px;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      align-items: center;\n      line-height: 1;\n    "], ["\n      width: 58px;\n      height: 68px;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      align-items: center;\n      line-height: 1;\n    "]))),
        navButtonContent: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      align-items: center;\n      width: 100%;\n      height: 100%;\n      white-space: normal;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      align-items: center;\n      width: 100%;\n      height: 100%;\n      white-space: normal;\n    "]))),
        scrollToTopButton: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 40px;\n      height: 40px;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      align-items: center;\n      margin-top: ", ";\n    "], ["\n      width: 40px;\n      height: 40px;\n      display: flex;\n      flex-direction: column;\n      justify-content: center;\n      align-items: center;\n      margin-top: ", ";\n    "])), theme.spacing(1)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=LogsNavigation.js.map
import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { LogsSortOrder } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, Spinner, useTheme2 } from '@grafana/ui';
import { TOP_BAR_LEVEL_HEIGHT } from 'app/core/components/AppChrome/types';
import { LogsNavigationPages } from './LogsNavigationPages';
function LogsNavigation({ absoluteRange, logsSortOrder, timeZone, loading, onChangeTime, scrollToTopLogs, visibleRange, queries, clearCache, addResultsToCache, }) {
    const [pages, setPages] = useState([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    // These refs are to determine, if we want to clear up logs navigation when totally new query is run
    const expectedQueriesRef = useRef();
    const expectedRangeRef = useRef();
    // This ref is to store range span for future queres based on firstly selected time range
    // e.g. if last 5 min selected, always run 5 min range
    const rangeSpanRef = useRef(0);
    const oldestLogsFirst = logsSortOrder === LogsSortOrder.Ascending;
    const onFirstPage = oldestLogsFirst ? currentPageIndex === pages.length - 1 : currentPageIndex === 0;
    const onLastPage = oldestLogsFirst ? currentPageIndex === 0 : currentPageIndex === pages.length - 1;
    const theme = useTheme2();
    const styles = getStyles(theme, oldestLogsFirst);
    // Main effect to set pages and index
    useEffect(() => {
        const newPage = { logsRange: visibleRange, queryRange: absoluteRange };
        let newPages = [];
        // We want to start new pagination if queries change or if absolute range is different than expected
        if (!isEqual(expectedRangeRef.current, absoluteRange) || !isEqual(expectedQueriesRef.current, queries)) {
            clearCache();
            setPages([newPage]);
            setCurrentPageIndex(0);
            expectedQueriesRef.current = queries;
            rangeSpanRef.current = absoluteRange.to - absoluteRange.from;
        }
        else {
            setPages((pages) => {
                // Remove duplicates with new query
                newPages = pages.filter((page) => !isEqual(newPage.queryRange, page.queryRange));
                // Sort pages based on logsOrder so they visually align with displayed logs
                newPages = [...newPages, newPage].sort((a, b) => sortPages(a, b, logsSortOrder));
                // Set new pages
                return newPages;
            });
            // Set current page index
            const index = newPages.findIndex((page) => page.queryRange.to === absoluteRange.to);
            setCurrentPageIndex(index);
        }
        addResultsToCache();
    }, [visibleRange, absoluteRange, logsSortOrder, queries, clearCache, addResultsToCache]);
    useEffect(() => {
        clearCache();
        // We can't enforce the eslint rule here because we only want to run when component is mounted.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const changeTime = useCallback(({ from, to }) => {
        expectedRangeRef.current = { from, to };
        onChangeTime({ from, to });
    }, [onChangeTime]);
    const sortPages = (a, b, logsSortOrder) => {
        if (logsSortOrder === LogsSortOrder.Ascending) {
            return a.queryRange.to > b.queryRange.to ? 1 : -1;
        }
        return a.queryRange.to > b.queryRange.to ? -1 : 1;
    };
    const olderLogsButton = (React.createElement(Button, { "data-testid": "olderLogsButton", className: styles.navButton, variant: "secondary", onClick: () => {
            //If we are not on the last page, use next page's range
            reportInteraction('grafana_explore_logs_pagination_clicked', {
                pageType: 'olderLogsButton',
            });
            if (!onLastPage) {
                const indexChange = oldestLogsFirst ? -1 : 1;
                changeTime({
                    from: pages[currentPageIndex + indexChange].queryRange.from,
                    to: pages[currentPageIndex + indexChange].queryRange.to,
                });
            }
            else {
                //If we are on the last page, create new range
                changeTime({ from: visibleRange.from - rangeSpanRef.current, to: visibleRange.from });
            }
            scrollToTopLogs();
        }, disabled: loading },
        React.createElement("div", { className: styles.navButtonContent },
            loading ? React.createElement(Spinner, null) : React.createElement(Icon, { name: oldestLogsFirst ? 'angle-up' : 'angle-down', size: "lg" }),
            "Older logs")));
    const newerLogsButton = (React.createElement(Button, { "data-testid": "newerLogsButton", className: styles.navButton, variant: "secondary", onClick: () => {
            reportInteraction('grafana_explore_logs_pagination_clicked', {
                pageType: 'newerLogsButton',
            });
            //If we are not on the first page, use previous page's range
            if (!onFirstPage) {
                const indexChange = oldestLogsFirst ? 1 : -1;
                changeTime({
                    from: pages[currentPageIndex + indexChange].queryRange.from,
                    to: pages[currentPageIndex + indexChange].queryRange.to,
                });
            }
            scrollToTopLogs();
            //If we are on the first page, button is disabled and we do nothing
        }, disabled: loading || onFirstPage },
        React.createElement("div", { className: styles.navButtonContent },
            loading && React.createElement(Spinner, null),
            onFirstPage || loading ? null : React.createElement(Icon, { name: oldestLogsFirst ? 'angle-down' : 'angle-up', size: "lg" }),
            onFirstPage ? 'Start of range' : 'Newer logs')));
    const onPageClick = useCallback((page, pageNumber) => {
        reportInteraction('grafana_explore_logs_pagination_clicked', {
            pageType: 'page',
            pageNumber,
        });
        !loading && changeTime({ from: page.queryRange.from, to: page.queryRange.to });
        scrollToTopLogs();
    }, [changeTime, loading, scrollToTopLogs]);
    return (React.createElement("div", { className: styles.navContainer },
        oldestLogsFirst ? olderLogsButton : newerLogsButton,
        React.createElement(LogsNavigationPages, { pages: pages, currentPageIndex: currentPageIndex, oldestLogsFirst: oldestLogsFirst, timeZone: timeZone, loading: loading, onClick: onPageClick }),
        oldestLogsFirst ? newerLogsButton : olderLogsButton,
        React.createElement(Button, { "data-testid": "scrollToTop", className: styles.scrollToTopButton, variant: "secondary", onClick: scrollToTopLogs, title: "Scroll to top" },
            React.createElement(Icon, { name: "arrow-up", size: "lg" }))));
}
export default memo(LogsNavigation);
const getStyles = (theme, oldestLogsFirst) => {
    const navContainerHeight = `calc(100vh - 2*${theme.spacing(2)} - 2*${TOP_BAR_LEVEL_HEIGHT}px)`;
    return {
        navContainer: css `
      max-height: ${navContainerHeight};
      display: flex;
      flex-direction: column;
      justify-content: ${oldestLogsFirst ? 'flex-start' : 'space-between'};
      position: sticky;
      top: ${theme.spacing(2)};
      right: 0;
    `,
        navButton: css `
      width: 58px;
      height: 68px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      line-height: 1;
    `,
        navButtonContent: css `
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      white-space: normal;
    `,
        scrollToTopButton: css `
      width: 40px;
      height: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin-top: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=LogsNavigation.js.map
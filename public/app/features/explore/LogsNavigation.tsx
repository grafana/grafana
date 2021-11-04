import React, { memo, useState, useEffect, useRef } from 'react';
import { isEqual } from 'lodash';
import { css } from 'emotion';
import { LogsSortOrder, AbsoluteTimeRange, TimeZone, DataQuery, GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Spinner, useTheme2 } from '@grafana/ui';
import { LogsNavigationPages } from './LogsNavigationPages';

type Props = {
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  queries: DataQuery[];
  loading: boolean;
  visibleRange: AbsoluteTimeRange;
  logsSortOrder?: LogsSortOrder | null;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  scrollToTopLogs: () => void;
  addResultsToCache: () => void;
  clearCache: () => void;
};

export type LogsPage = {
  logsRange: AbsoluteTimeRange;
  queryRange: AbsoluteTimeRange;
};

function LogsNavigation({
  absoluteRange,
  logsSortOrder,
  timeZone,
  loading,
  onChangeTime,
  scrollToTopLogs,
  visibleRange,
  queries,
  clearCache,
  addResultsToCache,
}: Props) {
  const [pages, setPages] = useState<LogsPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // These refs are to determine, if we want to clear up logs navigation when totally new query is run
  const expectedQueriesRef = useRef<DataQuery[]>();
  const expectedRangeRef = useRef<AbsoluteTimeRange>();
  // This ref is to store range span for future queres based on firstly selected time range
  // e.g. if last 5 min selected, always run 5 min range
  const rangeSpanRef = useRef(0);

  const oldestLogsFirst = logsSortOrder === LogsSortOrder.Ascending;
  const onFirstPage = currentPageIndex === 0;
  const onLastPage = currentPageIndex === pages.length - 1;
  const theme = useTheme2();
  const styles = getStyles(theme, oldestLogsFirst, loading);

  // Main effect to set pages and index
  useEffect(() => {
    const newPage = { logsRange: visibleRange, queryRange: absoluteRange };
    let newPages: LogsPage[] = [];
    // We want to start new pagination if queries change or if absolute range is different than expected
    if (!isEqual(expectedRangeRef.current, absoluteRange) || !isEqual(expectedQueriesRef.current, queries)) {
      clearCache();
      setPages([newPage]);
      setCurrentPageIndex(0);
      expectedQueriesRef.current = queries;
      rangeSpanRef.current = absoluteRange.to - absoluteRange.from;
    } else {
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
    return () => clearCache();
    // We can't enforce the eslint rule here because we only want to run when component unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTime = ({ from, to }: AbsoluteTimeRange) => {
    expectedRangeRef.current = { from, to };
    onChangeTime({ from, to });
  };

  const sortPages = (a: LogsPage, b: LogsPage, logsSortOrder?: LogsSortOrder | null) => {
    if (logsSortOrder === LogsSortOrder.Ascending) {
      return a.queryRange.to > b.queryRange.to ? 1 : -1;
    }
    return a.queryRange.to > b.queryRange.to ? -1 : 1;
  };

  const olderLogsButton = (
    <Button
      data-testid="olderLogsButton"
      className={styles.navButton}
      variant="secondary"
      onClick={() => {
        //If we are not on the last page, use next page's range
        if (!onLastPage) {
          changeTime({
            from: pages[currentPageIndex + 1].queryRange.from,
            to: pages[currentPageIndex + 1].queryRange.to,
          });
        } else {
          //If we are on the last page, create new range
          changeTime({ from: visibleRange.from - rangeSpanRef.current, to: visibleRange.from });
        }
      }}
      disabled={loading}
    >
      <div className={styles.navButtonContent}>
        {loading ? <Spinner /> : <Icon name={oldestLogsFirst ? 'angle-up' : 'angle-down'} size="lg" />}
        Older logs
      </div>
    </Button>
  );

  const newerLogsButton = (
    <Button
      data-testid="newerLogsButton"
      className={styles.navButton}
      variant="secondary"
      onClick={() => {
        //If we are not on the first page, use previous page's range
        if (!onFirstPage) {
          changeTime({
            from: pages[currentPageIndex - 1].queryRange.from,
            to: pages[currentPageIndex - 1].queryRange.to,
          });
        }
        //If we are on the first page, button is disabled and we do nothing
      }}
      disabled={loading || onFirstPage}
    >
      <div className={styles.navButtonContent}>
        {loading && <Spinner />}
        {onFirstPage || loading ? null : <Icon name={oldestLogsFirst ? 'angle-down' : 'angle-up'} size="lg" />}
        {onFirstPage ? 'Start of range' : 'Newer logs'}
      </div>
    </Button>
  );

  return (
    <div className={styles.navContainer}>
      {oldestLogsFirst ? olderLogsButton : newerLogsButton}
      <LogsNavigationPages
        pages={pages}
        currentPageIndex={currentPageIndex}
        oldestLogsFirst={oldestLogsFirst}
        timeZone={timeZone}
        loading={loading}
        changeTime={changeTime}
      />
      {oldestLogsFirst ? newerLogsButton : olderLogsButton}
      <Button
        data-testid="scrollToTop"
        className={styles.scrollToTopButton}
        variant="secondary"
        onClick={scrollToTopLogs}
        title="Scroll to top"
      >
        <Icon name="arrow-up" size="lg" />
      </Button>
    </div>
  );
}

export default memo(LogsNavigation);

const getStyles = (theme: GrafanaTheme2, oldestLogsFirst: boolean, loading: boolean) => {
  return {
    navContainer: css`
      max-height: 95vh;
      display: flex;
      flex-direction: column;
      justify-content: ${oldestLogsFirst ? 'flex-start' : 'space-between'};
      position: sticky;
      top: ${theme.spacing(2)};
      right: 0;
    `,
    navButton: css`
      width: 58px;
      height: 68px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      line-height: 1;
    `,
    navButtonContent: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      white-space: normal;
    `,
    scrollToTopButton: css`
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

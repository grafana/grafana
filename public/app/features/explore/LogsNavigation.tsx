import React, { memo, useState, useEffect, useRef } from 'react';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import { css } from 'emotion';
import {
  LogsSortOrder,
  AbsoluteTimeRange,
  dateTimeFormat,
  systemDateFormats,
  TimeZone,
  DataQuery,
  GrafanaTheme,
} from '@grafana/data';
import { Button, Icon, Spinner, useTheme, stylesFactory, CustomScrollbar } from '@grafana/ui';

type Props = {
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  queries: DataQuery[];
  loading: boolean;
  visibleRange?: AbsoluteTimeRange;
  logsSortOrder?: LogsSortOrder | null;
  onChangeTime: (range: AbsoluteTimeRange) => void;
};

type LogsPage = {
  logsRange: AbsoluteTimeRange;
  queryRange: AbsoluteTimeRange;
};

function LogsNavigation({
  absoluteRange,
  logsSortOrder,
  timeZone,
  loading,
  onChangeTime,
  visibleRange = absoluteRange,
  queries = [],
}: Props) {
  const [pages, setPages] = useState<LogsPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // These refs are to determine, if we want to clear up logs navigation when totally new query is run
  const expectedQueriesRef = useRef<DataQuery[]>();
  const expectedRangeRef = useRef<AbsoluteTimeRange>();
  // This ref is to store range span for future queres based on firstly selected time range
  // e.g. if last 5 min selected, always run 5 min range
  const rangeSpanRef = useRef(0);

  // Main effect to set pages and index
  useEffect(() => {
    const newPage = { logsRange: visibleRange, queryRange: absoluteRange };
    let newPages: LogsPage[] = [];
    // We want to start new pagination if queries change or if absolute range is different than expected
    if (!isEqual(expectedRangeRef.current, absoluteRange) || !isEqual(expectedQueriesRef.current, queries)) {
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
  }, [visibleRange, absoluteRange, logsSortOrder, queries]);

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

  const formatTime = (time: number) => {
    return `${dateTimeFormat(time, {
      format: systemDateFormats.interval.second,
      timeZone: timeZone,
    })}`;
  };

  const createPageContent = (page: LogsPage, index: number) => {
    if (currentPageIndex === index && loading) {
      return <Spinner />;
    }
    const topContent = formatTime(oldestLogsFirst ? page.logsRange.from : page.logsRange.to);
    const bottomContent = formatTime(oldestLogsFirst ? page.logsRange.to : page.logsRange.from);
    return `${topContent} — ${bottomContent}`;
  };

  const oldestLogsFirst = logsSortOrder === LogsSortOrder.Ascending;
  const theme = useTheme();
  const styles = getStyles(theme, oldestLogsFirst, loading);
  return (
    <div className={styles.navContainer}>
      {/*
       * We are going to have 2 buttons - on the top and bottom - Oldest and Newest.
       * Therefore I have at the moment duplicated the same code, but in the future iteration, it ill be updated
       */}
      {oldestLogsFirst && (
        <Button
          data-testid="fetchLogsTop"
          className={styles.navButton}
          variant="secondary"
          onClick={() => {
            // the range is based on initally selected range
            changeTime({ from: visibleRange.from - rangeSpanRef.current, to: visibleRange.from });
          }}
          disabled={loading}
        >
          <div className={styles.navButtonContent}>
            {loading ? <Spinner /> : <Icon name="angle-up" size="lg" />}
            Older logs
          </div>
        </Button>
      )}
      <CustomScrollbar autoHide>
        <div className={styles.pagesWrapper}>
          <div className={styles.pagesContainer}>
            {pages.map((page: LogsPage, index) => (
              <div
                className={styles.page}
                key={page.queryRange.to}
                onClick={() => !loading && changeTime({ from: page.queryRange.from, to: page.queryRange.to })}
              >
                <div className={classNames(styles.line, { selectedBg: currentPageIndex === index })} />
                <div className={classNames(styles.time, { selectedText: currentPageIndex === index })}>
                  {createPageContent(page, index)}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.filler}></div>
        </div>
      </CustomScrollbar>

      {!oldestLogsFirst && (
        <Button
          data-testid="fetchLogsBottom"
          className={styles.navButton}
          variant="secondary"
          onClick={() => {
            // the range is based on initally selected range
            changeTime({ from: visibleRange.from - rangeSpanRef.current, to: visibleRange.from });
          }}
          disabled={loading}
        >
          <div className={styles.navButtonContent}>
            Older logs
            {loading ? <Spinner /> : <Icon name="angle-down" size="lg" />}
          </div>
        </Button>
      )}
    </div>
  );
}

export default memo(LogsNavigation);

const getStyles = stylesFactory((theme: GrafanaTheme, oldestLogsFirst: boolean, loading: boolean) => {
  return {
    navContainer: css`
      max-height: 95vh;
      display: flex;
      flex-direction: column;
      justify-content: ${oldestLogsFirst ? 'flex-start' : 'space-between'};
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
    pagesWrapper: css`
      height: 100%;
      padding-left: ${theme.spacing.xs};
      display: flex;
      flex-direction: column;
      overflow-y: scroll;
    `,
    pagesContainer: css`
      display: flex;
      padding: 0;
      flex-direction: column;
    `,
    page: css`
      display: flex;
      margin: ${theme.spacing.md} 0;
      cursor: ${loading ? 'auto' : 'pointer'};
      white-space: normal;
      .selectedBg {
        background: ${theme.colors.bgBlue2};
      }
      .selectedText {
        color: ${theme.colors.bgBlue2};
      }
    `,
    line: css`
      width: 3px;
      height: 100%;
      align-items: center;
      background: ${theme.colors.textWeak};
    `,
    time: css`
      width: 60px;
      min-height: 80px;
      font-size: ${theme.typography.size.sm};
      padding-left: ${theme.spacing.xs};
      display: flex;
      align-items: center;
    `,
    filler: css`
      height: inherit;
      background: repeating-linear-gradient(
        135deg,
        ${theme.colors.bg1},
        ${theme.colors.bg1} 5px,
        ${theme.colors.bg2} 5px,
        ${theme.colors.bg2} 15px
      );
      width: 3px;
      margin-bottom: 8px;
    `,
  };
});

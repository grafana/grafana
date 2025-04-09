import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AbsoluteTimeRange, GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button, Icon, Spinner, useTheme2 } from '@grafana/ui';
import { getChromeHeaderLevelHeight } from 'app/core/components/AppChrome/TopBar/useChromeHeaderHeight';
import { t, Trans } from 'app/core/internationalization';

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
  scrollToBottomLogs?: () => void;
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
  scrollToBottomLogs,
  visibleRange,
  queries,
  clearCache,
  addResultsToCache,
}: Props) {
  const [pages, setPages] = useState<LogsPage[]>([]);

  // These refs are to determine, if we want to clear up logs navigation when totally new query is run
  const expectedQueriesRef = useRef<DataQuery[]>();
  const expectedRangeRef = useRef<AbsoluteTimeRange>();
  // This ref is to store range span for future queres based on firstly selected time range
  // e.g. if last 5 min selected, always run 5 min range
  const rangeSpanRef = useRef(0);

  const currentPageIndex = useMemo(
    () =>
      pages.findIndex((page) => {
        return page.queryRange.to === absoluteRange.to;
      }),
    [absoluteRange.to, pages]
  );

  const oldestLogsFirst = logsSortOrder === LogsSortOrder.Ascending;
  const onFirstPage = oldestLogsFirst ? currentPageIndex === pages.length - 1 : currentPageIndex === 0;
  const onLastPage = oldestLogsFirst ? currentPageIndex === 0 : currentPageIndex === pages.length - 1;
  const theme = useTheme2();
  const styles = getStyles(theme, oldestLogsFirst);

  // Main effect to set pages and index
  useEffect(() => {
    const newPage = { logsRange: visibleRange, queryRange: absoluteRange };
    let newPages: LogsPage[] = [];
    // We want to start new pagination if queries change or if absolute range is different than expected
    if (!isEqual(expectedRangeRef.current, absoluteRange) || !isEqual(expectedQueriesRef.current, queries)) {
      clearCache();
      setPages([newPage]);
      expectedQueriesRef.current = queries;
      rangeSpanRef.current = absoluteRange.to - absoluteRange.from;
    } else {
      setPages((pages) => {
        // Remove duplicates with new query
        newPages = pages.filter((page) => !isEqual(newPage.queryRange, page.queryRange));
        // Sort pages based on logsOrder so they visually align with displayed logs
        newPages = [...newPages, newPage].sort((a, b) => sortPages(a, b, logsSortOrder));
        return newPages;
      });
    }
  }, [visibleRange, absoluteRange, logsSortOrder, queries, clearCache, addResultsToCache]);

  const changeTime = useCallback(
    ({ from, to }: AbsoluteTimeRange) => {
      addResultsToCache();
      expectedRangeRef.current = { from, to };
      onChangeTime({ from, to });
    },
    [onChangeTime, addResultsToCache]
  );

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
        reportInteraction('grafana_explore_logs_pagination_clicked', {
          pageType: 'olderLogsButton',
        });
        if (!onLastPage) {
          const indexChange = oldestLogsFirst ? -1 : 1;
          changeTime({
            from: pages[currentPageIndex + indexChange].queryRange.from,
            to: pages[currentPageIndex + indexChange].queryRange.to,
          });
        } else {
          //If we are on the last page, create new range
          changeTime({ from: visibleRange.from - rangeSpanRef.current, to: visibleRange.from });
        }
        scrollToTopLogs();
      }}
      disabled={loading}
    >
      <div className={styles.navButtonContent}>
        {loading ? <Spinner /> : <Icon name={oldestLogsFirst ? 'angle-up' : 'angle-down'} size="lg" />}
        <Trans i18nKey={'logs.logs-navigation.older-logs'}>Older logs</Trans>
      </div>
    </Button>
  );

  const newerLogsButton = (
    <Button
      data-testid="newerLogsButton"
      className={styles.navButton}
      variant="secondary"
      onClick={() => {
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
      }}
      disabled={loading || onFirstPage}
    >
      <div className={styles.navButtonContent}>
        {loading && <Spinner />}
        {onFirstPage || loading ? null : <Icon name={oldestLogsFirst ? 'angle-down' : 'angle-up'} size="lg" />}
        {onFirstPage
          ? t('logs.logs-navigation.start-of-range', 'Start of range')
          : t('logs.logs-navigation.newer-logs', 'Newer logs')}
      </div>
    </Button>
  );

  const onPageClick = useCallback(
    (page: LogsPage, pageNumber: number) => {
      reportInteraction('grafana_explore_logs_pagination_clicked', {
        pageType: 'page',
        pageNumber,
      });
      changeTime({ from: page.queryRange.from, to: page.queryRange.to });
      scrollToTopLogs();
    },
    [changeTime, scrollToTopLogs]
  );

  const onScrollToTopClick = useCallback(() => {
    reportInteraction('grafana_explore_logs_scroll_top_clicked');
    scrollToTopLogs();
  }, [scrollToTopLogs]);

  const onScrollToBottomClick = useCallback(() => {
    reportInteraction('grafana_explore_logs_scroll_bottom_clicked');
    scrollToBottomLogs?.();
  }, [scrollToBottomLogs]);

  return (
    <div className={styles.navContainer}>
      {!config.featureToggles.logsInfiniteScrolling && (
        <>
          {oldestLogsFirst ? olderLogsButton : newerLogsButton}
          <LogsNavigationPages
            pages={pages}
            currentPageIndex={currentPageIndex}
            oldestLogsFirst={oldestLogsFirst}
            timeZone={timeZone}
            loading={loading}
            onClick={onPageClick}
          />
          {oldestLogsFirst ? newerLogsButton : olderLogsButton}
        </>
      )}
      {scrollToBottomLogs && (
        <Button
          data-testid="scrollToBottom"
          className={styles.scrollToBottomButton}
          variant="secondary"
          onClick={onScrollToBottomClick}
          title={t('logs.logs-navigation.scroll-bottom', 'Scroll to bottom')}
        >
          <Icon name="arrow-down" size="lg" />
        </Button>
      )}
      <Button
        data-testid="scrollToTop"
        className={styles.scrollToTopButton}
        variant="secondary"
        onClick={onScrollToTopClick}
        title={t('logs.logs-navigation.scroll-top', 'Scroll to top')}
      >
        <Icon name="arrow-up" size="lg" />
      </Button>
    </div>
  );
}

export default memo(LogsNavigation);

const getStyles = (theme: GrafanaTheme2, oldestLogsFirst: boolean) => {
  const navContainerHeight = `calc(100vh - 2*${theme.spacing(2)} - 2*${getChromeHeaderLevelHeight()}px)`;

  return {
    navContainer: css({
      maxHeight: navContainerHeight,
      width: oldestLogsFirst && !config.featureToggles.newLogsPanel ? '58px' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: config.featureToggles.logsInfiniteScrolling
        ? 'flex-end'
        : oldestLogsFirst
          ? 'flex-start'
          : 'space-between',
      position: 'sticky',
      top: theme.spacing(2),
      right: 0,
    }),
    navButton: css({
      width: '58px',
      height: '68px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      lineHeight: 1,
    }),
    navButtonContent: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      whiteSpace: 'normal',
    }),
    scrollToBottomButton: css({
      width: '40px',
      height: '40px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      top: 0,
    }),
    scrollToTopButton: css({
      width: '40px',
      height: '40px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing(1),
    }),
  };
};

import React, { memo, useState, useEffect } from 'react';
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
  logsSortOrder?: LogsSortOrder | null;
  visibleRange?: AbsoluteTimeRange;
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
  const [requestRange, setRequestRange] = useState(0);
  // These are to determine, if we want to clear up logs navigation when totally new query is run
  const [expectedRange, setExpectedRange] = useState<AbsoluteTimeRange>();
  const [expectedQueries, setExpectedQueries] = useState<DataQuery[]>([]);

  useEffect(() => {
    const newPage = { logsRange: visibleRange || absoluteRange, queryRange: absoluteRange };
    // We want to start new pagination if queries change or if absolute range is different than expected
    if (!isEqual(expectedRange, absoluteRange) || !isEqual(expectedQueries, queries)) {
      setPages([newPage]);
      setExpectedQueries(queries);
    } else {
      setPages((pages) => {
        const pagesWithNoDuplicates = pages.filter((page) => !isEqual(newPage.queryRange, page.queryRange));

        const newPagesArray = [...pagesWithNoDuplicates, newPage].sort((a, b) => {
          if (logsSortOrder === LogsSortOrder.Ascending) {
            return a.queryRange.to > b.queryRange.to ? 1 : -1;
          }
          return a.queryRange.to > b.queryRange.to ? -1 : 1;
        });
        return newPagesArray;
      });
    }
    // We don't want to add expectedRange as we want to run this only is absolute and visible range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, absoluteRange, logsSortOrder]);

  useEffect(() => {
    const index = pages.findIndex((page) => page.queryRange.to === absoluteRange.to);
    setCurrentPageIndex(index);
  }, [pages, absoluteRange]);

  useEffect(() => {
    const initialRange = absoluteRange.to - absoluteRange.from;
    setRequestRange(initialRange);
    // We want to set requestRange only when the first query is run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTime = ({ from, to }: AbsoluteTimeRange) => {
    setExpectedRange({ from, to });
    onChangeTime({ from, to });
  };

  const formatTime = (time: number) => {
    return `${dateTimeFormat(time, {
      format: systemDateFormats.interval.second,
      timeZone: timeZone,
    })}`;
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
            changeTime({ from: visibleRange.from - requestRange, to: visibleRange.from });
          }}
          disabled={loading}
        >
          <div className={styles.navButtonContent}>
            {loading ? <Spinner /> : <Icon name="angle-up" size="lg" />}
            <div>Older</div>
            <div>logs</div>
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
                  {`${formatTime(oldestLogsFirst ? page.logsRange.from : page.logsRange.to)} - ${formatTime(
                    oldestLogsFirst ? page.logsRange.to : page.logsRange.from
                  )}`}
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
            changeTime({ from: visibleRange.from - requestRange, to: visibleRange.from });
          }}
          disabled={loading}
        >
          <div className={styles.navButtonContent}>
            <div>Older</div>
            <div>logs</div>
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
      width: 70px;
      height: 95vh;
      display: flex;
      flex-direction: column;
      padding-left: ${theme.spacing.xs};
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
      width: 100%;
      padding: 0;
      flex-direction: column;
    `,
    page: css`
      display: flex;
      width: 100%;
      margin: ${theme.spacing.md} 0;
      cursor: ${loading ? 'auto' : 'pointer'};
      .selectedBg {
        background: ${theme.colors.bgBlue2};
      }
      .selectedText {
        color: ${theme.colors.bgBlue2};
      }
    `,
    line: css`
      width: 6px;
      height: 100%;

      align-items: center;
      background: ${theme.colors.textWeak};
    `,
    time: css`
      font-size: ${theme.typography.size.sm};
      padding: ${theme.spacing.md} 0 ${theme.spacing.md} ${theme.spacing.xs}; ;
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

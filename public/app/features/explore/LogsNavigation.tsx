import React, { memo, useState, useEffect } from 'react';
import classNames from 'classNames';
import { isEqual } from 'lodash';
import { css } from 'emotion';
import {
  LogsSortOrder,
  AbsoluteTimeRange,
  dateTimeFormat,
  systemDateFormats,
  TimeZone,
  DataQuery,
} from '@grafana/data';
import { Button, Icon, Spinner } from '@grafana/ui';

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
        const filteredChunksArray = pages.filter((page) => !isEqual(newPage.queryRange, page.queryRange));

        const newChunksArray = [...filteredChunksArray, newPage].sort((a, b) => {
          if (logsSortOrder === LogsSortOrder.Ascending) {
            return a.queryRange.to > b.queryRange.to ? 1 : -1;
          }
          return a.queryRange.to > b.queryRange.to ? -1 : 1;
        });
        return newChunksArray;
      });
    }
    // We don't want to add expectedRange as we want to run this only is absolute and visible range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, absoluteRange, logsSortOrder]);

  useEffect(() => {
    const index = pages.findIndex((page) => page.queryRange.to === absoluteRange.to);
    setCurrentPageIndex(index);
  }, [pages, absoluteRange]);

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

  const oldestFirst = logsSortOrder === LogsSortOrder.Ascending;
  const styles = getStyles(oldestFirst);
  return (
    <div className={styles.navContainer}>
      {/*We are going to have 2 buttons (on the top and bottom), Oldest and Newest. 
      Therefore I have at the moment duplicated the same code, but in the future iteration, it ill be updated */}
      {oldestFirst && (
        <Button
          className={styles.navButton}
          variant="secondary"
          onClick={() => {
            // From is currently hard coded
            // TODO: Update based on selected range (to is based on the last received log)
            changeTime({ from: absoluteRange.from - 3600000, to: visibleRange.from });
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
      <div className={styles.timeline}>
        {pages.map((page: LogsPage, index) => (
          <div
            className="wrap"
            key={page.queryRange.to}
            onClick={() => !loading && changeTime({ from: page.queryRange.from, to: page.queryRange.to })}
          >
            <div className={classNames('line', { blueBg: currentPageIndex === index })} />
            <div className={classNames(styles.time, { blueText: currentPageIndex === index })}>
              {`${formatTime(oldestFirst ? page.logsRange.from : page.logsRange.to)} - ${formatTime(
                oldestFirst ? page.logsRange.to : page.logsRange.from
              )}`}
            </div>
          </div>
        ))}
      </div>
      {!oldestFirst && (
        <Button
          className={styles.navButton}
          variant="secondary"
          onClick={() => {
            changeTime({ from: absoluteRange.from - 3600000, to: visibleRange.from });
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

function getStyles(oldestFirst: boolean) {
  return {
    navContainer: css`
      width: 70px !important;
      padding-left: 7px;
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: ${oldestFirst ? 'flex-start' : 'space-between'};
    `,
    navButton: css`
      width: 58px;
      height: 58px;
      line-height: 1;
      padding: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `,
    navButtonContent: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
    `,
    timeline: css`
      height: calc(100% - 160px);
      padding-left: 4px;
      .wrap {
        display: flex;
        width: 100%;
        height: calc((100% - 84px) / 10);
        margin: 14px 0;
        cursor: pointer;
        .line {
          background: gray;
          width: 6px;
          height: 100%;
        }
        .blueBg {
          background: #3871dc;
        }
        .blueText {
          color: #3871dc;
        }
        align-items: center;
      }
    `,
    time: css`
      font-size: 12px;
      padding-left: 4px;
    `,
  };
}

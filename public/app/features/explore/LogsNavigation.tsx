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
  logsSortOrder?: LogsSortOrder | null;
  visibleRange?: AbsoluteTimeRange;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  loading: boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  clearLogsNavigation: (shouldClear: boolean) => void;
  queries?: DataQuery[];
};

type LogsPage = {
  logsRange: AbsoluteTimeRange;
  queryRange: AbsoluteTimeRange;
};

function LogsNavigation({
  absoluteRange,
  visibleRange = absoluteRange,
  timeZone,
  onChangeTime,
  loading,
  clearLogsNavigation,
}: Props) {
  const [pages, setPages] = useState<LogsPage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expectedRange, setExpectedRange] = useState<AbsoluteTimeRange>();

  useEffect(() => {
    const newPage = { logsRange: visibleRange || absoluteRange, queryRange: absoluteRange };
    if (!expectedRange || !isEqual(expectedRange, absoluteRange)) {
      console.log('here 1');
      setPages([newPage]);
    } else {
      console.log('here 2');
      setPages((pages) => {
        const filteredChunksArray = pages.filter((page) => !isEqual(newPage.queryRange, page.queryRange));

        const newChunksArray = [...filteredChunksArray, newPage].sort((a, b) =>
          a.queryRange.to > b.queryRange.to ? -1 : 1
        );
        return newChunksArray;
      });
    }
    // We don't want to add expectedRange as we want to run this only is absolute and visible range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, absoluteRange]);

  useEffect(() => {
    const index = pages.findIndex((page) => page.queryRange.to === absoluteRange.to);
    setCurrentIndex(index);
  }, [pages, absoluteRange]);

  function changeTime({ from, to }: AbsoluteTimeRange) {
    setExpectedRange({ from, to });
    onChangeTime({ from, to });
  }

  function formatTime(time: number) {
    return `${dateTimeFormat(time, {
      format: systemDateFormats.interval.second,
      timeZone: timeZone,
    })}`;
  }

  const styles = getStyles();

  return (
    <div className={styles.wrapper}>
      <div className={styles.timeline}>
        {pages.map((page: LogsPage, index) => (
          <div
            className="wrap"
            key={page.queryRange.to}
            onClick={() => changeTime({ from: page.queryRange.from, to: page.queryRange.to })}
          >
            <div className={classNames('line', { blueBg: currentIndex === index })} />
            <div className={classNames(styles.time, { blueText: currentIndex === index })}>
              {`${formatTime(page.logsRange.to)} - ${formatTime(page.logsRange.from)}`}
            </div>
          </div>
        ))}
      </div>
      <Button
        className={styles.navigationButton}
        variant="secondary"
        onClick={() => {
          const requestedRange = { from: absoluteRange.from - 3600000, to: visibleRange.from };
          changeTime(requestedRange);
        }}
        disabled={loading}
      >
        <div className={styles.navigationButtonContent}>
          <div>Older</div>
          {loading ? <Spinner /> : <Icon name="angle-down" size="lg" />}
        </div>
      </Button>
      <Button className={styles.scrollUpButton} icon="arrow-up" variant="secondary" />
    </div>
  );
}

export default memo(LogsNavigation);

function getStyles() {
  return {
    wrapper: css`
      width: 70px !important;
      padding-left: 7px;
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `,
    navigationButton: css`
      width: 58px;
      height: 58px;
      line-height: 1;
      padding: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `,
    navigationButtonContent: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
    `,
    scrollUpButton: css`
      margin-top: 10px;
      height: 35px;
      width: 35px;
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

import React, { memo, useState, useEffect } from 'react';
import classNames from 'classNames';
import { isEqual } from 'lodash';
import { css } from 'emotion';
import { LogsSortOrder, AbsoluteTimeRange, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { Button, Icon, Spinner } from '@grafana/ui';

type Props = {
  logsSortOrder?: LogsSortOrder | null;
  visibleRange?: AbsoluteTimeRange;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  loading: boolean;
  logsNavigationCleared?: boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  clearLogsNavigation: (shouldClear: boolean) => void;
};

type LogsTimelineChunk = {
  logsRange: AbsoluteTimeRange;
  queryRange: AbsoluteTimeRange;
};

function LogsNavigation({
  visibleRange,
  absoluteRange,
  timeZone,
  onChangeTime,
  loading,
  logsNavigationCleared,
  clearLogsNavigation,
}: Props) {
  const [chunksArray, setChunksArray] = useState<LogsTimelineChunk[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const newChunk = { logsRange: visibleRange || absoluteRange, queryRange: absoluteRange };
    if (logsNavigationCleared) {
      setChunksArray([newChunk]);
    } else {
      setChunksArray((array) => {
        const filteredChunksArray = array.filter((chunk) => !isEqual(newChunk.queryRange, chunk.queryRange));
        console.log(filteredChunksArray);

        const newChunksArray = [...filteredChunksArray, newChunk].sort((a, b) =>
          a.queryRange.to > b.queryRange.to ? -1 : 1
        );
        return newChunksArray;
      });
    }
  }, [visibleRange, absoluteRange, logsNavigationCleared]);

  useEffect(() => {
    const index = chunksArray.findIndex((chunk) => chunk.queryRange.to === absoluteRange.to);
    setCurrentIndex(index);
  }, [chunksArray, absoluteRange]);

  function changeTime({ from, to }: AbsoluteTimeRange) {
    clearLogsNavigation(false);
    onChangeTime({ from, to });
  }

  const styles = getStyles();
  return (
    <div className={styles.wrapper}>
      <div className={styles.timeline}>
        {chunksArray.map((chunk: LogsTimelineChunk, index) => (
          <div
            className="wrap"
            key={index}
            onClick={() => changeTime({ from: chunk.queryRange.from, to: chunk.queryRange.to })}
          >
            <div className={classNames('line', { blueBg: currentIndex === index })} />
            <div className={classNames(styles.time, { blueText: currentIndex === index })}>{`${dateTimeFormat(
              chunk.logsRange.to,
              {
                format: systemDateFormats.interval.second,
              }
            )} - ${dateTimeFormat(chunk.logsRange.from, {
              format: systemDateFormats.interval.second,
              timeZone: timeZone,
            })}`}</div>
          </div>
        ))}
      </div>
      <Button
        className={styles.navigationButton}
        variant="secondary"
        onClick={() => {
          changeTime({ from: absoluteRange.from, to: visibleRange.from });
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

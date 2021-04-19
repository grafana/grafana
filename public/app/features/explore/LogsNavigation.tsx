import React, { memo, useState, useEffect } from 'react';
import classNames from 'classNames';
import { uniqBy, sortBy } from 'lodash';
import { css } from 'emotion';
import { LogsSortOrder, AbsoluteTimeRange, dateTimeFormat, systemDateFormats, TimeZone } from '@grafana/data';
import { Button, Icon, Spinner } from '@grafana/ui';

type Props = {
  logsSortOrder?: LogsSortOrder | null;
  visibleRange: AbsoluteTimeRange;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  loading: boolean;
  logsNavigationCleared?: boolean;
  onChangeTime: (range: AbsoluteTimeRange) => void;
  clearLogsNavigation: (shouldClear: boolean) => void;
};

function LogsNavigation({
  logsSortOrder,
  visibleRange,
  absoluteRange,
  timeZone,
  onChangeTime,
  loading,
  logsNavigationCleared,
  clearLogsNavigation,
}: Props) {
  const [chunksArray, setChunksArray] = useState<AbsoluteTimeRange[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (logsNavigationCleared) {
      setChunksArray([visibleRange]);
      setCurrentIndex(0);
    } else {
      const currentChunksArray = chunksArray;
      const newChunksArray = sortBy(uniqBy([...currentChunksArray, visibleRange], 'to'), 'from').reverse();
      const currentIndex = newChunksArray.findIndex((chunk) => chunk.to === visibleRange.to);
      setChunksArray(newChunksArray);
      setCurrentIndex(currentIndex);
    }
  }, [visibleRange, logsNavigationCleared]);

  function changeTime({ from, to }: AbsoluteTimeRange) {
    clearLogsNavigation(false);
    onChangeTime({ from, to });
  }

  const styles = getStyles();
  const newLogsOnTop = !logsSortOrder || logsSortOrder === LogsSortOrder.Descending;
  return (
    <div className={styles.wrapper}>
      <Button className={styles.navigationButton} variant="secondary">
        <div className={styles.navigationButtonContent}>
          <Icon name="angle-up" size="lg" />
          <div>{newLogsOnTop ? 'Newer' : 'Older'}</div>
        </div>
      </Button>
      <div className={styles.timeline}>
        {chunksArray.map((range: AbsoluteTimeRange, index) => (
          <div className="wrap" key={range.from} onClick={() => changeTime({ from: range.from, to: range.to })}>
            <div className={classNames('line', { blueBg: currentIndex === index })} />
            <div className={classNames(styles.time, { blueText: currentIndex === index })}>{`${dateTimeFormat(
              range.to,
              {
                format: systemDateFormats.interval.second,
              }
            )} - ${dateTimeFormat(range.from, {
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
          <div>{newLogsOnTop ? 'Older' : 'Newer'}</div>
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

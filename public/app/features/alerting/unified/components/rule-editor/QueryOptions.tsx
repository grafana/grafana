import { css } from '@emotion/css';
import React, { useState } from 'react';

import { dateTime, getDefaultRelativeTimeRange, GrafanaTheme2, RelativeTimeRange } from '@grafana/data';
import { relativeToTimeRange } from '@grafana/data/src/datetime/rangeutil';
import { clearButtonStyles, Icon, RelativeTimeRangePicker, Toggletip, useStyles2 } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertQueryOptions, MaxDataPointsOption } from './QueryWrapper';

export interface QueryOptionsProps {
  query: AlertQuery;
  queryOptions: AlertQueryOptions;
  onChangeTimeRange?: (timeRange: RelativeTimeRange, index: number) => void;
  onChangeQueryOptions: (options: AlertQueryOptions, index: number) => void;
  index: number;
}

export const QueryOptions = ({
  query,
  queryOptions,
  onChangeTimeRange,
  onChangeQueryOptions,
  index,
}: QueryOptionsProps) => {
  const styles = useStyles2(getStyles);

  const [showOptions, setShowOptions] = useState(false);

  const timeRange = query.relativeTimeRange ? relativeToTimeRange(query.relativeTimeRange) : undefined;

  return (
    <>
      <Toggletip
        content={
          <div className={styles.container}>
            <div>
              {onChangeTimeRange && (
                <div className={styles.timeRangeContainer}>
                  <span className={styles.timeRangeLabel}>Time Range</span>
                  <RelativeTimeRangePicker
                    timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
                    onChange={(range) => onChangeTimeRange(range, index)}
                  />
                </div>
              )}
            </div>
            <div className={styles.queryOptions}>
              <MaxDataPointsOption
                options={queryOptions}
                onChange={(options) => onChangeQueryOptions(options, index)}
              />
            </div>
          </div>
        }
        closeButton={true}
        placement="bottom-start"
      >
        <button type="button" className={styles.actionLink} onClick={() => setShowOptions(!showOptions)}>
          Options {showOptions ? <Icon name="angle-right" /> : <Icon name="angle-down" />}
        </button>
      </Toggletip>

      <div className={styles.staticValues}>
        <span>{dateTime(timeRange?.from).locale('en').fromNow(true)}</span>
        {queryOptions.maxDataPoints && <span>, MD {queryOptions.maxDataPoints}</span>}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
    container: css`
      display: flex;
      flex-direction: column;
      gap: 10px;
    `,
    timeRangeContainer: css`
      display: flex;
    `,

    timeRangeLabel: css`
      width: 20%;
    `,
    queryOptions: css`
      margin-bottom: -${theme.spacing(2)};

      label {
        line-height: 12px;
        padding: 0px;
      }
    `,

    staticValues: css`
      color: ${theme.colors.text.secondary};
      margin-right: ${theme.spacing(1)};
    `,

    actionLink: css`
      ${clearButton};
      color: ${theme.colors.text.link};
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    `,
  };
};

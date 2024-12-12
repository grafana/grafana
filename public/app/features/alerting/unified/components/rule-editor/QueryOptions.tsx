import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, RelativeTimeRange, dateTime, getDefaultRelativeTimeRange } from '@grafana/data';
import { relativeToTimeRange } from '@grafana/data/src/datetime/rangeutil';
import { Icon, InlineField, RelativeTimeRangePicker, Toggletip, clearButtonStyles, useStyles2 } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertQueryOptions, MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

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
          <div className={styles.queryOptions}>
            {onChangeTimeRange && (
              <InlineField label="Time Range">
                <RelativeTimeRangePicker
                  timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
                  onChange={(range) => onChangeTimeRange(range, index)}
                />
              </InlineField>
            )}
            <MaxDataPointsOption options={queryOptions} onChange={(options) => onChangeQueryOptions(options, index)} />
            <MinIntervalOption options={queryOptions} onChange={(options) => onChangeQueryOptions(options, index)} />
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
        {queryOptions.maxDataPoints && <span>, MD = {queryOptions.maxDataPoints}</span>}
        {queryOptions.minInterval && <span>, Min. Interval = {queryOptions.minInterval}</span>}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
    queryOptions: css({
      '> div': {
        justifyContent: 'space-between',
      },
    }),

    staticValues: css({
      color: theme.colors.text.secondary,
      marginRight: theme.spacing(1),
    }),

    actionLink: css(clearButton, {
      color: theme.colors.text.link,
      cursor: 'pointer',

      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};

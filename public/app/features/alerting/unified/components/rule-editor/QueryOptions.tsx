import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2, type RelativeTimeRange, getDefaultRelativeTimeRange, rangeUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, InlineField, RelativeTimeRangePicker, Toggletip, clearButtonStyles, useStyles2 } from '@grafana/ui';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { TimeRangeLabel } from '../TimeRangeLabel';

import { type AlertQueryOptions, MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

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
  const [localMaxDataPoints, setLocalMaxDataPoints] = useState(queryOptions.maxDataPoints?.toString() ?? '');
  const [localMinInterval, setLocalMinInterval] = useState(queryOptions.minInterval ?? '');

  // Keep local state in sync when external props change
  useEffect(() => {
    setLocalMaxDataPoints(queryOptions.maxDataPoints?.toString() ?? '');
    setLocalMinInterval(queryOptions.minInterval ?? '');
  }, [queryOptions.maxDataPoints, queryOptions.minInterval]);

  const stateRef = useRef({ localMaxDataPoints, localMinInterval, queryOptions, onChangeQueryOptions, index });
  stateRef.current = { localMaxDataPoints, localMinInterval, queryOptions, onChangeQueryOptions, index };

  const commitOptions = useCallback(() => {
    const { localMaxDataPoints, localMinInterval, queryOptions, onChangeQueryOptions, index } = stateRef.current;
    
    let validatedMaxDataPoints = queryOptions.maxDataPoints;
    let validatedMinInterval = queryOptions.minInterval;
    let newLocalMaxDataPoints = localMaxDataPoints;
    let newLocalMinInterval = localMinInterval;

    const maxDataPointsNumber = parseInt(localMaxDataPoints, 10);
    if (!isNaN(maxDataPointsNumber) && maxDataPointsNumber !== 0) {
      validatedMaxDataPoints = maxDataPointsNumber;
    } else {
      // Clear the value if the input is intentionally empty, or if an invalid number/zero was entered
      validatedMaxDataPoints = undefined;
      newLocalMaxDataPoints = '';
    }

    if (localMinInterval !== '') {
      try {
        rangeUtil.intervalToMs(localMinInterval);
        validatedMinInterval = localMinInterval;
      } catch (e) {
        // Invalid interval, revert input to last valid value
        newLocalMinInterval = queryOptions.minInterval ?? '';
        validatedMinInterval = queryOptions.minInterval;
      }
    } else {
      validatedMinInterval = undefined;
      newLocalMinInterval = '';
    }

    if (newLocalMaxDataPoints !== localMaxDataPoints) {
      setLocalMaxDataPoints(newLocalMaxDataPoints);
    }
    
    if (newLocalMinInterval !== localMinInterval) {
      setLocalMinInterval(newLocalMinInterval);
    }

    if (validatedMaxDataPoints !== queryOptions.maxDataPoints || validatedMinInterval !== queryOptions.minInterval) {
      onChangeQueryOptions(
        {
          maxDataPoints: validatedMaxDataPoints,
          minInterval: validatedMinInterval,
        },
        index
      );
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        commitOptions();
      }
    },
    [commitOptions]
  );

  const separator = <span>, </span>;

  return (
    <>
      <Toggletip
        content={
          <div className={styles.queryOptions}>
            {onChangeTimeRange && (
              <InlineField label={t('alerting.query-options.label-time-range', 'Time Range')}>
                <RelativeTimeRangePicker
                  timeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()}
                  onChange={(range) => onChangeTimeRange(range, index)}
                />
              </InlineField>
            )}
            <MaxDataPointsOption 
              value={localMaxDataPoints} 
              onChange={setLocalMaxDataPoints} 
              onBlur={commitOptions}
              onKeyDown={onKeyDown}
            />
            <MinIntervalOption 
              value={localMinInterval} 
              onChange={setLocalMinInterval} 
              onBlur={commitOptions}
              onKeyDown={onKeyDown}
            />
          </div>
        }
        closeButton={true}
        placement="bottom-start"
        onClose={commitOptions}
      >
        <button type="button" className={styles.actionLink} onClick={() => setShowOptions(!showOptions)}>
          <Trans i18nKey="alerting.query-options.button-options">Options</Trans>{' '}
          {showOptions ? <Icon name="angle-right" /> : <Icon name="angle-down" />}
        </button>
      </Toggletip>

      <div className={styles.staticValues}>
        <span>
          <TimeRangeLabel relativeTimeRange={query.relativeTimeRange ?? getDefaultRelativeTimeRange()} />
        </span>

        {queryOptions.maxDataPoints && (
          <>
            {separator}
            <Trans
              i18nKey="alerting.query-options.max-data-points"
              values={{ maxDataPoints: queryOptions.maxDataPoints }}
            >
              MD = {'{{maxDataPoints}}'}
            </Trans>
          </>
        )}
        {queryOptions.minInterval && (
          <>
            {separator}
            <Trans i18nKey="alerting.query-options.min-interval" values={{ minInterval: queryOptions.minInterval }}>
              Min. Interval = {'{{minInterval}}'}
            </Trans>
          </>
        )}
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

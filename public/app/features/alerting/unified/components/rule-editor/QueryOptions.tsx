import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type RelativeTimeRange, getDefaultRelativeTimeRange, rangeUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  Icon,
  InlineField,
  RelativeTimeRangePicker,
  Stack,
  Toggletip,
  clearButtonStyles,
  useStyles2,
} from '@grafana/ui';
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
  const [localMaxDataPoints, setLocalMaxDataPoints] = useState(queryOptions?.maxDataPoints?.toString() ?? '');
  const [localMinInterval, setLocalMinInterval] = useState(queryOptions?.minInterval ?? '');
  const [intervalError, setIntervalError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setLocalMaxDataPoints(queryOptions.maxDataPoints?.toString() ?? '');
    setLocalMinInterval(queryOptions.minInterval ?? '');
    setIntervalError(undefined);
  }, [queryOptions.maxDataPoints, queryOptions.minInterval]);

  const handleMinIntervalChange = (value: string) => {
    setLocalMinInterval(value);
    setIntervalError(undefined);
  };

  const resetOptions = () => {
    setLocalMaxDataPoints(queryOptions?.maxDataPoints?.toString() ?? '');
    setLocalMinInterval(queryOptions?.minInterval ?? '');
    setIntervalError(undefined);
  };

  const applyOptions = () => {
    let validatedMaxDataPoints: number | undefined = queryOptions.maxDataPoints;
    let validatedMinInterval: string | undefined = queryOptions.minInterval;
    let nextLocalMaxDataPoints = localMaxDataPoints;

    const maxDataPointsNumber = parseInt(localMaxDataPoints, 10);
    if (!isNaN(maxDataPointsNumber) && maxDataPointsNumber !== 0) {
      validatedMaxDataPoints = maxDataPointsNumber;
    } else {
      validatedMaxDataPoints = undefined;
      nextLocalMaxDataPoints = '';
    }

    if (localMinInterval !== '') {
      try {
        rangeUtil.intervalToMs(localMinInterval);
        validatedMinInterval = localMinInterval;
      } catch (e) {
        setIntervalError(
          t('alerting.query-options.invalid-interval-error', 'Invalid interval format. Examples: 1s, 5m, 1h')
        );
        return;
      }
    } else {
      validatedMinInterval = undefined;
    }

    setLocalMaxDataPoints(nextLocalMaxDataPoints);
    setIntervalError(undefined);

    onChangeQueryOptions(
      {
        maxDataPoints: validatedMaxDataPoints,
        minInterval: validatedMinInterval,
      },
      index
    );

    setShowOptions(false);
  };

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
            <MaxDataPointsOption value={localMaxDataPoints} onChange={setLocalMaxDataPoints} />
            <MinIntervalOption
              value={localMinInterval}
              onChange={handleMinIntervalChange}
              invalid={!!intervalError}
              error={intervalError}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button size="sm" onClick={applyOptions}>
                <Trans i18nKey="alerting.query-options.apply-button">Apply</Trans>
              </Button>
            </Stack>
          </div>
        }
        closeButton={true}
        placement="bottom-start"
        show={showOptions}
        onOpen={() => setShowOptions(true)}
        onClose={() => {
          resetOptions();
          setShowOptions(false);
        }}
      >
        <button type="button" className={styles.actionLink}>
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
      '> div:not(:last-child)': {
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

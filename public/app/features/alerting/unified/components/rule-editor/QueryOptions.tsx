import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { GrafanaTheme2, RelativeTimeRange, getDefaultRelativeTimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, InlineField, RelativeTimeRangePicker, Toggletip, clearButtonStyles, useStyles2 } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { TimeRangeLabel } from '../TimeRangeLabel';

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

  // Add refs to capture input values
  const maxDataPointsRef = useRef<HTMLInputElement>(null);
  const minIntervalRef = useRef<HTMLInputElement>(null);

  // Handler to save input values when tooltip closes
  const handleTooltipClose = () => {
    // Get current values from inputs
    const maxDataPointsValue = maxDataPointsRef.current?.value;
    const minIntervalValue = minIntervalRef.current?.value;

    const updatedOptions = { ...queryOptions };
    let hasChanges = false;

    // Parse and save max data points
    if (maxDataPointsValue !== undefined) {
      const maxDataPointsNumber = parseInt(maxDataPointsValue, 10);
      const maxDataPoints = isNaN(maxDataPointsNumber) || maxDataPointsNumber === 0 ? undefined : maxDataPointsNumber;

      if (maxDataPoints !== queryOptions.maxDataPoints) {
        updatedOptions.maxDataPoints = maxDataPoints;
        hasChanges = true;
      }
    }

    // Save min interval
    if (minIntervalValue !== undefined && minIntervalValue !== queryOptions.minInterval) {
      updatedOptions.minInterval = minIntervalValue || undefined;
      hasChanges = true;
    }

    // Only call onChange if there are actual changes
    if (hasChanges) {
      console.log('🐛 Saving changes on tooltip close:', updatedOptions);
      onChangeQueryOptions(updatedOptions, index);
    }
  };

  const separator = <span>, </span>;

  return (
    <>
      <Toggletip
        onClose={handleTooltipClose}
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
              options={queryOptions}
              onChange={(options) => onChangeQueryOptions(options, index)}
              inputRef={maxDataPointsRef}
            />
            <MinIntervalOption
              options={queryOptions}
              onChange={(options) => onChangeQueryOptions(options, index)}
              inputRef={minIntervalRef}
            />
          </div>
        }
        closeButton={true}
        placement="bottom-start"
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

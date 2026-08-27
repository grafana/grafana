import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { type GrafanaTheme2, type RelativeTimeRange, getDefaultRelativeTimeRange } from '@grafana/data';
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

function haveQueryOptionsChanged(a: AlertQueryOptions, b: AlertQueryOptions) {
  return a.maxDataPoints !== b.maxDataPoints || a.minInterval !== b.minInterval;
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
  const draftOptionsRef = useRef<AlertQueryOptions>(queryOptions);

  const handleOpen = () => {
    draftOptionsRef.current = queryOptions;
    setShowOptions(true);
  };

  const handleClose = () => {
    // Dismissing the toggletip can unmount these inputs without a blur, so persist the draft here.
    const draft = draftOptionsRef.current;
    if (haveQueryOptionsChanged(draft, queryOptions)) {
      onChangeQueryOptions(draft, index);
    }
    setShowOptions(false);
  };

  const handleMaxDataPointsChange = (options: AlertQueryOptions) => {
    draftOptionsRef.current = {
      ...draftOptionsRef.current,
      maxDataPoints: options.maxDataPoints,
    };
  };

  const handleMinIntervalChange = (options: AlertQueryOptions) => {
    draftOptionsRef.current = {
      ...draftOptionsRef.current,
      minInterval: options.minInterval,
    };
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
            <MaxDataPointsOption options={queryOptions} onChange={handleMaxDataPointsChange} />
            <MinIntervalOption options={queryOptions} onChange={handleMinIntervalChange} />
          </div>
        }
        closeButton={true}
        placement="bottom-start"
        onOpen={handleOpen}
        onClose={handleClose}
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

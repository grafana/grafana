import { css, cx } from '@emotion/css';
import React, { useState, ChangeEvent, FocusEvent, useCallback } from 'react';

import { rangeUtil, PanelData, DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { Input, InlineSwitch, useStyles2, InlineLabel } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryGroupOptions } from 'app/types';

interface Props {
  options: QueryGroupOptions;
  dataSource: DataSourceApi;
  data: PanelData;
  onChange: (options: QueryGroupOptions) => void;
}

export const QueryGroupOptionsEditor = React.memo(({ options, dataSource, data, onChange }: Props) => {
  const [timeRangeFrom, setTimeRangeFrom] = useState(options.timeRange?.from || '');
  const [timeRangeShift, setTimeRangeShift] = useState(options.timeRange?.shift || '');
  const [timeRangeHide, setTimeRangeHide] = useState(options.timeRange?.hide ?? false);
  const [isOpen, setIsOpen] = useState(false);
  const [relativeTimeIsValid, setRelativeTimeIsValid] = useState(true);
  const [timeShiftIsValid, setTimeShiftIsValid] = useState(true);

  const styles = useStyles2(getStyles);

  const onRelativeTimeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTimeRangeFrom(event.target.value);
  }, []);

  const onTimeShiftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTimeRangeShift(event.target.value);
  }, []);

  const onOverrideTime = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const newValue = emptyToNull(event.target.value);
      const isValid = timeRangeValidation(newValue);

      if (isValid && options.timeRange?.from !== newValue) {
        onChange({
          ...options,
          timeRange: {
            ...(options.timeRange ?? {}),
            from: newValue,
          },
        });
      }

      setRelativeTimeIsValid(isValid);
    },
    [onChange, options]
  );

  const onTimeShift = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const newValue = emptyToNull(event.target.value);
      const isValid = timeRangeValidation(newValue);

      if (isValid && options.timeRange?.shift !== newValue) {
        onChange({
          ...options,
          timeRange: {
            ...(options.timeRange ?? {}),
            shift: newValue,
          },
        });
      }

      setTimeShiftIsValid(isValid);
    },
    [onChange, options]
  );

  const onToggleTimeOverride = useCallback(() => {
    const newTimeRangeHide = !timeRangeHide;
    setTimeRangeHide(newTimeRangeHide);
    onChange({
      ...options,
      timeRange: {
        ...(options.timeRange ?? {}),
        hide: newTimeRangeHide,
      },
    });
  }, [onChange, options, timeRangeHide]);

  const onCacheTimeoutBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        cacheTimeout: emptyToNull(event.target.value),
      });
    },
    [onChange, options]
  );

  const onQueryCachingTTLBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      let ttl: number | null = parseInt(event.target.value, 10);

      if (isNaN(ttl) || ttl === 0) {
        ttl = null;
      }

      onChange({
        ...options,
        queryCachingTTL: ttl,
      });
    },
    [onChange, options]
  );

  const onMaxDataPointsBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      let maxDataPoints: number | null = parseInt(event.currentTarget.value, 10);

      if (isNaN(maxDataPoints) || maxDataPoints === 0) {
        maxDataPoints = null;
      }

      if (maxDataPoints !== options.maxDataPoints) {
        onChange({
          ...options,
          maxDataPoints,
        });
      }
    },
    [onChange, options]
  );

  const onMinIntervalBlur = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const minInterval = emptyToNull(event.target.value);
      if (minInterval !== options.minInterval) {
        onChange({
          ...options,
          minInterval,
        });
      }
    },
    [onChange, options]
  );

  const onOpenOptions = useCallback(() => {
    setIsOpen(true);
  }, []);

  const onCloseOptions = useCallback(() => {
    setIsOpen(false);
  }, []);

  const renderCacheTimeoutOption = () => {
    const tooltip = `If your time series store has a query cache this option can override the default cache timeout. Specify a
    numeric value in seconds.`;

    if (!dataSource.meta.queryOptions?.cacheTimeout) {
      return null;
    }

    return (
      <>
        <InlineLabel tooltip={tooltip} htmlFor="cache-timeout-id">
          Cache timeout
        </InlineLabel>
        <Input
          id="cache-timeout-id"
          type="text"
          placeholder="60"
          spellCheck={false}
          onBlur={onCacheTimeoutBlur}
          defaultValue={options.cacheTimeout ?? ''}
        />
      </>
    );
  };

  const renderQueryCachingTTLOption = () => {
    const tooltip = `Cache time-to-live: How long results from this queries in this panel will be cached, in milliseconds. Defaults to the TTL in the caching configuration for this datasource.`;

    if (!dataSource.cachingConfig?.enabled) {
      return null;
    }

    return (
      <>
        <InlineLabel tooltip={tooltip}>Cache TTL</InlineLabel>
        <Input
          type="number"
          placeholder={`${dataSource.cachingConfig.TTLMs}`}
          spellCheck={false}
          onBlur={onQueryCachingTTLBlur}
          defaultValue={options.queryCachingTTL ?? undefined}
        />
      </>
    );
  };

  const renderMaxDataPointsOption = () => {
    const realMd = data.request?.maxDataPoints;
    const value = options.maxDataPoints ?? '';
    const isAuto = value === '';

    return (
      <>
        <InlineLabel
          htmlFor="max-data-points-input"
          tooltip={
            <>
              The maximum data points per series. Used directly by some data sources and used in calculation of auto
              interval. With streaming data this value is used for the rolling buffer.
            </>
          }
        >
          Max data points
        </InlineLabel>
        <Input
          id="max-data-points-input"
          type="number"
          placeholder={`${realMd}`}
          spellCheck={false}
          onBlur={onMaxDataPointsBlur}
          defaultValue={value}
        />
        {isAuto && (
          <>
            <span className={cx(styles.noSquish, styles.operator)}>=</span>
            <span className={cx(styles.noSquish, styles.left)}>Width of panel</span>
          </>
        )}
      </>
    );
  };

  const renderIntervalOption = () => {
    const realInterval = data.request?.interval;
    const minIntervalOnDs = dataSource.interval ?? 'No limit';

    return (
      <>
        <InlineLabel
          className={styles.firstColumn}
          tooltip={
            <>
              A lower limit for the interval. Recommended to be set to write frequency, for example <code>1m</code> if
              your data is written every minute. Default value can be set in data source settings for most data sources.
            </>
          }
          htmlFor="min-interval-input"
        >
          Min interval
        </InlineLabel>
        <Input
          id="min-interval-input"
          type="text"
          placeholder={`${minIntervalOnDs}`}
          spellCheck={false}
          onBlur={onMinIntervalBlur}
          defaultValue={options.minInterval ?? ''}
        />
        <InlineLabel
          className={styles.firstColumn}
          tooltip={
            <>
              The evaluated interval that is sent to data source and is used in <code>$__interval</code> and{' '}
              <code>$__interval_ms</code>. This value is not exactly equal to <code>Time range / max data points</code>,
              it will approximate a series of magic number.
            </>
          }
        >
          Interval
        </InlineLabel>
        <span className={styles.noSquish}>{realInterval}</span>
        <span className={cx(styles.noSquish, styles.operator)}>=</span>
        <span className={cx(styles.noSquish, styles.left)}>Time range / max data points</span>
      </>
    );
  };

  const renderCollapsedText = (): React.ReactNode | undefined => {
    if (isOpen) {
      return undefined;
    }

    let mdDesc = options.maxDataPoints ?? '';
    if (mdDesc === '' && data.request) {
      mdDesc = `auto = ${data.request.maxDataPoints}`;
    }

    const intervalDesc = data.request?.interval ?? options.minInterval;

    return (
      <>
        {<span className={styles.collapsedText}>MD = {mdDesc}</span>}
        {<span className={styles.collapsedText}>Interval = {intervalDesc}</span>}
      </>
    );
  };

  return (
    <QueryOperationRow
      id="Query options"
      index={0}
      title="Query options"
      headerElement={renderCollapsedText()}
      isOpen={isOpen}
      onOpen={onOpenOptions}
      onClose={onCloseOptions}
    >
      <div className={styles.grid}>
        {renderMaxDataPointsOption()}
        {renderIntervalOption()}
        {renderCacheTimeoutOption()}
        {renderQueryCachingTTLOption()}

        <InlineLabel
          htmlFor="relative-time-input"
          tooltip={
            <>
              Overrides the relative time range for individual panels, which causes them to be different than what is
              selected in the dashboard time picker in the top-right corner of the dashboard. For example to configure
              the Last 5 minutes the Relative time should be <code>now-5m</code> and <code>5m</code>, or variables like{' '}
              <code>$_relativeTime</code>.
            </>
          }
        >
          Relative time
        </InlineLabel>
        <Input
          id="relative-time-input"
          type="text"
          placeholder="1h"
          onChange={onRelativeTimeChange}
          onBlur={onOverrideTime}
          invalid={!relativeTimeIsValid}
          value={timeRangeFrom}
        />
        <InlineLabel
          htmlFor="time-shift-input"
          className={styles.firstColumn}
          tooltip={
            <>
              Overrides the time range for individual panels by shifting its start and end relative to the time picker.
              For example to configure the Last 1h the Time shift should be <code>now-1h</code> and <code>1h</code>, or
              variables like <code>$_timeShift</code>.
            </>
          }
        >
          Time shift
        </InlineLabel>
        <Input
          id="time-shift-input"
          type="text"
          placeholder="1h"
          onChange={onTimeShiftChange}
          onBlur={onTimeShift}
          invalid={!timeShiftIsValid}
          value={timeRangeShift}
        />
        {(timeRangeShift || timeRangeFrom) && (
          <>
            <InlineLabel htmlFor="hide-time-info-switch" className={styles.firstColumn}>
              Hide time info
            </InlineLabel>
            <InlineSwitch
              id="hide-time-info-switch"
              className={styles.left}
              value={timeRangeHide}
              onChange={onToggleTimeOverride}
            />
          </>
        )}
      </div>
    </QueryOperationRow>
  );
});

QueryGroupOptionsEditor.displayName = 'QueryGroupOptionsEditor';

function timeRangeValidation(value: string | null) {
  return !value || rangeUtil.isValidTimeSpan(value);
}

function emptyToNull(value: string) {
  return value === '' ? null : value;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: `auto minmax(5em, 1fr) auto 1fr`,
      gap: theme.spacing(0.5),
      gridAutoRows: theme.spacing(4),
      whiteSpace: 'nowrap',
    }),
    firstColumn: css({
      gridColumn: 1,
    }),
    collapsedText: css({
      marginLeft: theme.spacing(2),
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
    }),
    noSquish: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    left: css({
      justifySelf: 'left',
    }),
    operator: css({
      color: theme.v1.palette.orange,
    }),
  };
}

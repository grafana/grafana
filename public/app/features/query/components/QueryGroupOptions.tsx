import { css, cx } from '@emotion/css';
import React, { useState, ChangeEvent, FocusEvent, useCallback } from 'react';

import { rangeUtil, PanelData, DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { Input, InlineSwitch, useStyles2, InlineLabel } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { Trans, t } from 'app/core/internationalization';
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
          <Trans i18nKey="query.query-group-options-editor.render-cache-timeout-option.cache-timeout">
            Cache timeout
          </Trans>
        </InlineLabel>
        <Input
          id="cache-timeout-id"
          type="text"
          // eslint-disable-next-line @grafana/no-untranslated-strings
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
        <InlineLabel tooltip={tooltip}>
          <Trans i18nKey="query.query-group-options-editor.render-query-caching-ttloption.cache-ttl">Cache TTL</Trans>
        </InlineLabel>
        <Input
          type="number"
          // eslint-disable-next-line @grafana/no-untranslated-strings
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
            <Trans i18nKey="query.query-group-options-editor.render-max-data-points-option.max-data-points-tooltip">
              The maximum data points per series. Used directly by some data sources and used in calculation of auto
              interval. With streaming data this value is used for the rolling buffer.
            </Trans>
          }
        >
          <Trans i18nKey="query.query-group-options-editor.render-max-data-points-option.max-data-points">
            Max data points
          </Trans>
        </InlineLabel>
        <Input
          id="max-data-points-input"
          type="number"
          // eslint-disable-next-line @grafana/no-untranslated-strings
          placeholder={`${realMd}`}
          spellCheck={false}
          onBlur={onMaxDataPointsBlur}
          defaultValue={value}
        />
        {isAuto && (
          <>
            <span className={cx(styles.noSquish, styles.operator)}>=</span>
            <span className={cx(styles.noSquish, styles.left)}>
              <Trans i18nKey="query.query-group-options-editor.render-max-data-points-option.width-of-panel">
                Width of panel
              </Trans>
            </span>
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
            <Trans i18nKey="query.query-group-options-editor.render-interval-option.min-interval-tooltip">
              A lower limit for the interval. Recommended to be set to write frequency, for example <code>1m</code> if
              your data is written every minute. Default value can be set in data source settings for most data sources.
            </Trans>
          }
          htmlFor="min-interval-input"
        >
          <Trans i18nKey="query.query-group-options-editor.render-interval-option.min-interval">Min interval</Trans>
        </InlineLabel>
        <Input
          id="min-interval-input"
          type="text"
          // eslint-disable-next-line @grafana/no-untranslated-strings
          placeholder={`${minIntervalOnDs}`}
          spellCheck={false}
          onBlur={onMinIntervalBlur}
          defaultValue={options.minInterval ?? ''}
        />
        <InlineLabel
          className={styles.firstColumn}
          tooltip={
            <Trans i18nKey="query.query-group-options-editor.render-interval-option.interval-tooltip">
              The evaluated interval that is sent to data source and is used in <code>$__interval</code> and{' '}
              <code>$__interval_ms</code>. This value is not exactly equal to <code>Time range / max data points</code>,
              it will approximate a series of magic number.
            </Trans>
          }
        >
          <Trans i18nKey="query.query-group-options-editor.render-interval-option.interval">Interval</Trans>
        </InlineLabel>
        <span className={styles.noSquish}>{realInterval}</span>
        <span className={cx(styles.noSquish, styles.operator)}>=</span>
        <span className={cx(styles.noSquish, styles.left)}>
          <Trans i18nKey="query.query-group-options-editor.render-interval-option.time-range-max-data-points">
            Time range / max data points
          </Trans>
        </span>
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
        {
          <span className={styles.collapsedText}>
            <Trans i18nKey="query.query-group-options-editor.collapsed-max-data-points">MD = {{ mdDesc }}</Trans>
          </span>
        }
        {
          <span className={styles.collapsedText}>
            <Trans i18nKey="query.query-group-options-editor.collapsed-interval">Interval = {{ intervalDesc }}</Trans>
          </span>
        }
      </>
    );
  };

  return (
    <QueryOperationRow
      id="Query options"
      index={0}
      title={t('query.query-group-options-editor.Query options-title-query-options', 'Query options')}
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
            <Trans
              i18nKey="query.query-group-options-editor.relative-time-tooltip"
              values={{ relativeFrom: 'now-5m', relativeTo: '5m', variable: '$_relativeTime' }}
            >
              Overrides the relative time range for individual panels, which causes them to be different than what is
              selected in the dashboard time picker in the top-right corner of the dashboard. For example to configure
              the Last 5 minutes the Relative time should be <code>{'{{relativeFrom}}'}</code> and{' '}
              <code>{'{{relativeTo}}'}</code>, or variables like <code>{'{{variable}}'}</code>.
            </Trans>
          }
        >
          <Trans i18nKey="query.query-group-options-editor.relative-time">Relative time</Trans>
        </InlineLabel>
        <Input
          id="relative-time-input"
          type="text"
          // eslint-disable-next-line @grafana/no-untranslated-strings
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
            <Trans
              i18nKey="query.query-group-options-editor.time-shift-tooltip"
              values={{ relativeFrom: 'now-1h', relativeTo: '1h', variable: '$_timeShift' }}
            >
              Overrides the time range for individual panels by shifting its start and end relative to the time picker.
              For example to configure the Last 1h the Time shift should be <code>{'{{relativeFrom}}'}</code> and{' '}
              <code>{'{{relativeTo}}'}</code>, or variables like <code>{'{{variable}}'}</code>.
            </Trans>
          }
        >
          <Trans i18nKey="query.query-group-options-editor.time-shift">Time shift</Trans>
        </InlineLabel>
        <Input
          id="time-shift-input"
          type="text"
          // eslint-disable-next-line @grafana/no-untranslated-strings
          placeholder="1h"
          onChange={onTimeShiftChange}
          onBlur={onTimeShift}
          invalid={!timeShiftIsValid}
          value={timeRangeShift}
        />
        {(timeRangeShift || timeRangeFrom) && (
          <>
            <InlineLabel htmlFor="hide-time-info-switch" className={styles.firstColumn}>
              <Trans i18nKey="query.query-group-options-editor.hide-time-info">Hide time info</Trans>
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

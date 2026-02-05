import { css } from '@emotion/css';
import { ChangeEvent, FocusEvent, useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, Input, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { TIME_OPTION_PLACEHOLDER } from '../../constants';
import {
  useActionsContext,
  useDatasourceContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

function timeRangeValidation(value: string | null) {
  return !value || rangeUtil.isValidTimeSpan(value);
}

function emptyToNull(value: string) {
  return value === '' ? null : value;
}

export function QueryEditorDetailsSidebar() {
  const styles = useStyles2(getStyles);
  const { datasource, dsSettings } = useDatasourceContext();
  const { data } = useQueryRunnerContext();
  const { queryOptions } = useQueryEditorUIContext();
  const { options, setIsQueryOptionsOpen } = queryOptions;
  const { onQueryOptionsChange } = useActionsContext();

  const handleClose = () => {
    setIsQueryOptionsOpen(false);
  };

  // Local state for controlled inputs
  const [relativeTimeValue, setRelativeTimeValue] = useState(options.timeRange?.from || '');
  const [timeShiftValue, setTimeShiftValue] = useState(options.timeRange?.shift || '');
  const [relativeTimeIsValid, setRelativeTimeIsValid] = useState(true);
  const [timeShiftIsValid, setTimeShiftIsValid] = useState(true);

  // Local state is initialized from props but won't update if options changes externally (e.g., undo/redo, external state change).
  useEffect(() => {
    setRelativeTimeValue(options.timeRange?.from || '');
    setTimeShiftValue(options.timeRange?.shift || '');
  }, [options.timeRange?.from, options.timeRange?.shift]);

  // Get computed values from data request
  const realMaxDataPoints = data?.request?.maxDataPoints;
  const realInterval = data?.request?.interval;
  const minIntervalOnDs = datasource?.interval ?? t('query-editor.details-sidebar.no-limit', 'No limit');

  // Handlers
  const onMaxDataPointsBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      let maxDataPoints: number | null = parseInt(event.currentTarget.value, 10);

      if (isNaN(maxDataPoints) || maxDataPoints === 0) {
        maxDataPoints = null;
      }

      if (maxDataPoints !== options.maxDataPoints) {
        onQueryOptionsChange({
          ...options,
          maxDataPoints,
        });
      }
    },
    [onQueryOptionsChange, options]
  );

  const onMinIntervalBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const minInterval = emptyToNull(event.target.value);
      if (minInterval !== options.minInterval) {
        onQueryOptionsChange({
          ...options,
          minInterval,
        });
      }
    },
    [onQueryOptionsChange, options]
  );

  const onRelativeTimeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setRelativeTimeValue(event.target.value);
  }, []);

  const onRelativeTimeBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const newValue = emptyToNull(event.target.value);
      const isValid = timeRangeValidation(newValue);

      if (isValid && options.timeRange?.from !== newValue) {
        onQueryOptionsChange({
          ...options,
          timeRange: {
            ...(options.timeRange ?? {}),
            from: newValue,
          },
        });
      }

      setRelativeTimeIsValid(isValid);
    },
    [onQueryOptionsChange, options]
  );

  const onTimeShiftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTimeShiftValue(event.target.value);
  }, []);

  const onTimeShiftBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const newValue = emptyToNull(event.target.value);
      const isValid = timeRangeValidation(newValue);

      if (isValid && options.timeRange?.shift !== newValue) {
        onQueryOptionsChange({
          ...options,
          timeRange: {
            ...(options.timeRange ?? {}),
            shift: newValue,
          },
        });
      }

      setTimeShiftIsValid(isValid);
    },
    [onQueryOptionsChange, options]
  );

  // Check if caching options should be shown
  const showCacheTimeout = dsSettings?.meta.queryOptions?.cacheTimeout;
  const showCacheTTL = dsSettings?.cachingConfig?.enabled;

  const onCacheTimeoutBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      onQueryOptionsChange({
        ...options,
        cacheTimeout: emptyToNull(event.target.value),
      });
    },
    [onQueryOptionsChange, options]
  );

  const onCacheTTLBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      let ttl: number | null = parseInt(event.target.value, 10);

      if (isNaN(ttl) || ttl === 0) {
        ttl = null;
      }

      onQueryOptionsChange({
        ...options,
        queryCachingTTL: ttl,
      });
    },
    [onQueryOptionsChange, options]
  );

  return (
    <div className={styles.container}>
      <Button
        fill="text"
        size="lg"
        icon="angle-right"
        className={styles.header}
        onClick={handleClose}
        aria-expanded={true}
        aria-label={t('query-editor.details-sidebar.collapse', 'Collapse query options sidebar')}
      >
        <span className={styles.headerText}>
          <Trans i18nKey="query-editor.details-sidebar.title">Query Options</Trans>
        </span>
      </Button>
      <div className={styles.content}>
        <Stack direction="column" gap={1}>
          {/* Max data points */}
          <div className={styles.field}>
            <Tooltip
              content={t(
                'query-editor.details-sidebar.max-data-points-tooltip',
                'The maximum data points per series. Used directly by some data sources and used in calculation of auto interval.'
              )}
            >
              <Icon name="info-circle" size="md" className={styles.infoIcon} />
            </Tooltip>
            <span className={styles.fieldLabel}>
              <Trans i18nKey="query-editor.details-sidebar.max-data-points">Max data points</Trans>
            </span>
            <Input
              type="number"
              defaultValue={options.maxDataPoints ?? ''}
              placeholder={realMaxDataPoints ? String(realMaxDataPoints) : ''}
              onBlur={onMaxDataPointsBlur}
              aria-label={t('query-editor.details-sidebar.max-data-points', 'Max data points')}
              className={styles.fieldInput}
            />
          </div>

          {/* Min interval */}
          <div className={styles.field}>
            <Tooltip
              content={t(
                'query-editor.details-sidebar.min-interval-tooltip',
                'A lower limit for the interval. Recommended to be set to write frequency, for example 1m if your data is written every minute.'
              )}
            >
              <Icon name="info-circle" size="md" className={styles.infoIcon} />
            </Tooltip>
            <span className={styles.fieldLabel}>
              <Trans i18nKey="query-editor.details-sidebar.min-interval">Min interval</Trans>
            </span>
            <Input
              type="text"
              defaultValue={options.minInterval ?? ''}
              placeholder={String(minIntervalOnDs)}
              onBlur={onMinIntervalBlur}
              aria-label={t('query-editor.details-sidebar.min-interval', 'Min interval')}
              className={styles.fieldInput}
            />
          </div>

          {/* Interval (read-only) */}
          <div className={styles.field}>
            <Tooltip
              content={t(
                'query-editor.details-sidebar.interval-tooltip',
                'The evaluated interval that is sent to data source and is used in $__interval and $__interval_ms.'
              )}
            >
              <Icon name="info-circle" size="md" className={styles.infoIcon} />
            </Tooltip>
            <span className={styles.fieldLabel}>
              <Trans i18nKey="query-editor.details-sidebar.interval">Interval</Trans>
            </span>
            <span className={styles.fieldValue}>{realInterval ?? '-'}</span>
          </div>

          {/* Relative time */}
          <div className={styles.field}>
            <Tooltip
              content={t(
                'query-editor.details-sidebar.relative-time-tooltip',
                'Overrides the relative time range for individual panels. For example, to configure the Last 5 minutes use now-5m.'
              )}
            >
              <Icon name="info-circle" size="md" className={styles.infoIcon} />
            </Tooltip>
            <span className={styles.fieldLabel}>
              <Trans i18nKey="query-editor.details-sidebar.relative-time">Relative time</Trans>
            </span>
            <Input
              type="text"
              value={relativeTimeValue}
              placeholder={TIME_OPTION_PLACEHOLDER}
              onChange={onRelativeTimeChange}
              onBlur={onRelativeTimeBlur}
              invalid={!relativeTimeIsValid}
              aria-label={t('query-editor.details-sidebar.relative-time', 'Relative time')}
              className={styles.fieldInput}
            />
          </div>

          {/* Time shift */}
          <div className={styles.field}>
            <Tooltip
              content={t(
                'query-editor.details-sidebar.time-shift-tooltip',
                'Overrides the time range for individual panels by shifting its start and end relative to the time picker.'
              )}
            >
              <Icon name="info-circle" size="md" className={styles.infoIcon} />
            </Tooltip>
            <span className={styles.fieldLabel}>
              <Trans i18nKey="query-editor.details-sidebar.time-shift">Time shift</Trans>
            </span>
            <Input
              type="text"
              value={timeShiftValue}
              placeholder={TIME_OPTION_PLACEHOLDER}
              onChange={onTimeShiftChange}
              onBlur={onTimeShiftBlur}
              invalid={!timeShiftIsValid}
              aria-label={t('query-editor.details-sidebar.time-shift', 'Time shift')}
              className={styles.fieldInput}
            />
          </div>

          {/* Cache timeout (conditional) */}
          {showCacheTimeout && (
            <div className={styles.field}>
              <Tooltip
                content={t(
                  'query-editor.details-sidebar.cache-timeout-tooltip',
                  'If your time series store has a query cache this option can override the default cache timeout. Specify a numeric value in seconds.'
                )}
              >
                <Icon name="info-circle" size="md" className={styles.infoIcon} />
              </Tooltip>
              <span className={styles.fieldLabel}>
                <Trans i18nKey="query-editor.details-sidebar.cache-timeout">Cache timeout</Trans>
              </span>
              <Input
                type="text"
                defaultValue={options.cacheTimeout ?? ''}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                placeholder="60"
                onBlur={onCacheTimeoutBlur}
                aria-label={t('query-editor.details-sidebar.cache-timeout', 'Cache timeout')}
                className={styles.fieldInput}
              />
            </div>
          )}

          {/* Cache TTL (conditional) */}
          {showCacheTTL && (
            <div className={styles.field}>
              <Tooltip
                content={t(
                  'query-editor.details-sidebar.cache-ttl-tooltip',
                  'Cache time-to-live: How long results from the queries in this panel will be cached, in milliseconds.'
                )}
              >
                <Icon name="info-circle" size="md" className={styles.infoIcon} />
              </Tooltip>
              <span className={styles.fieldLabel}>
                <Trans i18nKey="query-editor.details-sidebar.cache-ttl">Cache TTL</Trans>
              </span>
              <Input
                type="number"
                defaultValue={options.queryCachingTTL ?? ''}
                placeholder={dsSettings?.cachingConfig?.TTLMs ? String(dsSettings.cachingConfig.TTLMs) : ''}
                onBlur={onCacheTTLBlur}
                aria-label={t('query-editor.details-sidebar.cache-ttl', 'Cache TTL')}
                className={styles.fieldInput}
              />
            </div>
          )}
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      width: 220,
      height: '100%',
      backgroundColor: theme.colors.background.primary,
    }),
    header: css({
      width: '100%',
      justifyContent: 'flex-start',
      padding: theme.spacing(1, 1.5),
      borderRadius: 'unset',

      '& > svg': {
        color: theme.colors.text.primary,
      },

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    headerText: css({
      color: theme.colors.primary.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    content: css({
      flex: 1,
      padding: theme.spacing(1.5),
      overflow: 'auto',
    }),
    field: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),
    }),
    fieldLabel: css({
      flex: 1,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
    }),
    fieldInput: css({
      width: 76,
      flexShrink: 0,
    }),
    fieldValue: css({
      width: 76,
      flexShrink: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      textAlign: 'right',
    }),
    infoIcon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
  };
}

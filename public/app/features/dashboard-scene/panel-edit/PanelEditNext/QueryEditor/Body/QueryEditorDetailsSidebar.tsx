import { css } from '@emotion/css';
import { FocusEvent, ReactNode, useCallback, useRef } from 'react';

import { GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ClickOutsideWrapper, Icon, Input, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { CONTENT_SIDE_BAR, TIME_OPTION_PLACEHOLDER } from '../../constants';
import {
  useActionsContext,
  useDatasourceContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { QueryOptionField } from '../types';

interface OptionFieldProps {
  tooltip: string;
  label: string;
  children: ReactNode;
}

function OptionField({ tooltip, label, children }: OptionFieldProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.field}>
      <Tooltip content={tooltip}>
        <Icon name="info-circle" size="md" className={styles.infoIcon} />
      </Tooltip>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

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
  const { onQueryOptionsChange } = useActionsContext();
  const { options, closeSidebar, focusedField } = queryOptions;

  const sidebarRef = useRef<HTMLDivElement>(null);

  const realMaxDataPoints = data?.request?.maxDataPoints;
  const realInterval = data?.request?.interval;
  const minIntervalOnDs = datasource?.interval ?? t('query-editor.details-sidebar.no-limit', 'No limit');
  const showCacheTimeout = dsSettings?.meta.queryOptions?.cacheTimeout;
  const showCacheTTL = dsSettings?.cachingConfig?.enabled;

  const handleCloseSidebar = useCallback(() => {
    // Blur any focused input to trigger its blur handler before closing
    if (document.activeElement instanceof HTMLElement && sidebarRef.current?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    closeSidebar();
  }, [closeSidebar]);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>, field: QueryOptionField) => {
      const value = event.currentTarget.value;

      // Handle number fields
      if (field === QueryOptionField.maxDataPoints || field === QueryOptionField.queryCachingTTL) {
        let numValue: number | null = parseInt(value, 10);
        if (isNaN(numValue) || numValue === 0) {
          numValue = null;
        }
        if (numValue !== options[field]) {
          onQueryOptionsChange({ ...options, [field]: numValue });
        }
        return;
      }

      // Handle time range fields
      if (field === QueryOptionField.relativeTime || field === QueryOptionField.timeShift) {
        const stringValue = emptyToNull(value);
        const isValid = timeRangeValidation(stringValue);
        const timeRangeField = field === QueryOptionField.relativeTime ? 'from' : 'shift';
        if (isValid && stringValue !== options.timeRange?.[timeRangeField]) {
          onQueryOptionsChange({
            ...options,
            timeRange: { ...(options.timeRange ?? {}), [timeRangeField]: stringValue },
          });
        }
        return;
      }

      // Handle min interval (time span validation)
      if (field === QueryOptionField.minInterval) {
        const stringValue = emptyToNull(value);
        const isValid = timeRangeValidation(stringValue);
        if (isValid && stringValue !== options.minInterval) {
          onQueryOptionsChange({ ...options, minInterval: stringValue });
        }
        return;
      }

      // Handle string fields (cacheTimeout)
      const stringValue = emptyToNull(value);
      if (field === QueryOptionField.cacheTimeout && stringValue !== options.cacheTimeout) {
        onQueryOptionsChange({ ...options, cacheTimeout: stringValue });
      }
    },
    [options, onQueryOptionsChange]
  );

  return (
    <ClickOutsideWrapper onClick={handleCloseSidebar}>
      <div ref={sidebarRef} className={styles.container}>
        <Button
          fill="text"
          size="lg"
          icon="angle-right"
          className={styles.header}
          onClick={handleCloseSidebar}
          aria-expanded={true}
          aria-label={t('query-editor.details-sidebar.collapse', 'Collapse query options sidebar')}
        >
          <span className={styles.headerText}>
            <Trans i18nKey="query-editor.details-sidebar.title">Query Options</Trans>
          </span>
        </Button>
        <div className={styles.content}>
          <Stack direction="column" gap={0.5}>
            <OptionField
              tooltip={t(
                'query-editor.details-sidebar.max-data-points-tooltip',
                'The maximum data points per series. Used directly by some data sources and used in calculation of auto interval.'
              )}
              label={t('query-editor.details-sidebar.max-data-points', 'Max data points')}
            >
              <Input
                type="number"
                defaultValue={options.maxDataPoints ?? ''}
                placeholder={realMaxDataPoints ? String(realMaxDataPoints) : ''}
                onBlur={(e) => handleBlur(e, QueryOptionField.maxDataPoints)}
                autoFocus={focusedField === QueryOptionField.maxDataPoints}
                aria-label={t('query-editor.details-sidebar.max-data-points', 'Max data points')}
                className={styles.fieldInput}
              />
            </OptionField>

            <OptionField
              tooltip={t(
                'query-editor.details-sidebar.min-interval-tooltip',
                'A lower limit for the interval. Recommended to be set to write frequency, for example 1m if your data is written every minute.'
              )}
              label={t('query-editor.details-sidebar.min-interval', 'Min interval')}
            >
              <Input
                type="text"
                defaultValue={options.minInterval ?? ''}
                placeholder={String(minIntervalOnDs)}
                onBlur={(e) => handleBlur(e, QueryOptionField.minInterval)}
                autoFocus={focusedField === QueryOptionField.minInterval}
                aria-label={t('query-editor.details-sidebar.min-interval', 'Min interval')}
                className={styles.fieldInput}
              />
            </OptionField>

            <OptionField
              tooltip={t(
                'query-editor.details-sidebar.interval-tooltip',
                'The evaluated interval that is sent to data source and is used in $__interval and $__interval_ms.'
              )}
              label={t('query-editor.details-sidebar.interval', 'Interval')}
            >
              <span className={styles.fieldValue}>{realInterval ?? '-'}</span>
            </OptionField>

            <OptionField
              tooltip={t(
                'query-editor.details-sidebar.relative-time-tooltip',
                'Overrides the relative time range for individual panels. For example, to configure the Last 5 minutes use now-5m.'
              )}
              label={t('query-editor.details-sidebar.relative-time', 'Relative time')}
            >
              <Input
                type="text"
                defaultValue={options.timeRange?.from ?? ''}
                placeholder={TIME_OPTION_PLACEHOLDER}
                onBlur={(e) => handleBlur(e, QueryOptionField.relativeTime)}
                autoFocus={focusedField === QueryOptionField.relativeTime}
                aria-label={t('query-editor.details-sidebar.relative-time', 'Relative time')}
                className={styles.fieldInput}
              />
            </OptionField>

            <OptionField
              tooltip={t(
                'query-editor.details-sidebar.time-shift-tooltip',
                'Overrides the time range for individual panels by shifting its start and end relative to the time picker.'
              )}
              label={t('query-editor.details-sidebar.time-shift', 'Time shift')}
            >
              <Input
                type="text"
                defaultValue={options.timeRange?.shift ?? ''}
                placeholder={TIME_OPTION_PLACEHOLDER}
                onBlur={(e) => handleBlur(e, QueryOptionField.timeShift)}
                autoFocus={focusedField === QueryOptionField.timeShift}
                aria-label={t('query-editor.details-sidebar.time-shift', 'Time shift')}
                className={styles.fieldInput}
              />
            </OptionField>

            {showCacheTimeout && (
              <OptionField
                tooltip={t(
                  'query-editor.details-sidebar.cache-timeout-tooltip',
                  'If your time series store has a query cache this option can override the default cache timeout. Specify a numeric value in seconds.'
                )}
                label={t('query-editor.details-sidebar.cache-timeout', 'Cache timeout')}
              >
                <Input
                  type="text"
                  defaultValue={options.cacheTimeout ?? ''}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="60"
                  onBlur={(e) => handleBlur(e, QueryOptionField.cacheTimeout)}
                  autoFocus={focusedField === QueryOptionField.cacheTimeout}
                  aria-label={t('query-editor.details-sidebar.cache-timeout', 'Cache timeout')}
                  className={styles.fieldInput}
                />
              </OptionField>
            )}

            {showCacheTTL && (
              <OptionField
                tooltip={t(
                  'query-editor.details-sidebar.cache-ttl-tooltip',
                  'Cache time-to-live: How long results from the queries in this panel will be cached, in milliseconds.'
                )}
                label={t('query-editor.details-sidebar.cache-ttl', 'Cache TTL')}
              >
                <Input
                  type="number"
                  defaultValue={options.queryCachingTTL ?? ''}
                  placeholder={dsSettings?.cachingConfig?.TTLMs ? String(dsSettings.cachingConfig.TTLMs) : ''}
                  onBlur={(e) => handleBlur(e, QueryOptionField.queryCachingTTL)}
                  autoFocus={focusedField === QueryOptionField.queryCachingTTL}
                  aria-label={t('query-editor.details-sidebar.cache-ttl', 'Cache TTL')}
                  className={styles.fieldInput}
                />
              </OptionField>
            )}
          </Stack>
        </div>
      </div>
    </ClickOutsideWrapper>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      width: CONTENT_SIDE_BAR.width,
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
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'nowrap',
    }),
    fieldInput: css({
      width: CONTENT_SIDE_BAR.labelWidth,
      flexShrink: 0,
    }),
    fieldValue: css({
      width: CONTENT_SIDE_BAR.labelWidth,
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

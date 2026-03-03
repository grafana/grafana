import { css } from '@emotion/css';
import { FocusEvent, useCallback, useRef } from 'react';

import { GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClickOutsideWrapper, Stack, Switch, useStyles2 } from '@grafana/ui';

import {
  useActionsContext,
  useDatasourceContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';
import { QueryOptionField } from '../types';

import { OptionField } from './OptionField';

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
  const minIntervalOnDs = datasource?.interval ?? t('query-editor-next.details-sidebar.no-limit', 'No limit');
  const showCacheTimeout = dsSettings?.meta.queryOptions?.cacheTimeout;
  const showCacheTTL = dsSettings?.cachingConfig?.enabled;
  const showHideTimeOverride = options.timeRange?.from != null || options.timeRange?.shift != null;

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

      const stringValue = emptyToNull(value);

      // Handle time range fields
      if (field === QueryOptionField.relativeTime || field === QueryOptionField.timeShift) {
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
        const isValid = timeRangeValidation(stringValue);
        if (isValid && stringValue !== options.minInterval) {
          onQueryOptionsChange({ ...options, minInterval: stringValue });
        }
        return;
      }

      // Handle string fields (cacheTimeout)
      if (field === QueryOptionField.cacheTimeout && stringValue !== options.cacheTimeout) {
        onQueryOptionsChange({ ...options, cacheTimeout: stringValue });
      }
    },
    [options, onQueryOptionsChange]
  );

  const handleHideTimeOverrideChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onQueryOptionsChange({
        ...options,
        timeRange: { ...(options.timeRange ?? {}), hide: event.currentTarget.checked },
      });
    },
    [options, onQueryOptionsChange]
  );

  // Shared props for all input-based OptionFields
  const inputProps = { onBlur: handleBlur, focusedField };

  return (
    <ClickOutsideWrapper onClick={handleCloseSidebar}>
      <div ref={sidebarRef} className={styles.container}>
        <div className={styles.content}>
          <Stack direction="column" gap={0.5}>
            <OptionField
              field={QueryOptionField.maxDataPoints}
              {...inputProps}
              defaultValue={options.maxDataPoints ?? ''}
              placeholder={realMaxDataPoints ? String(realMaxDataPoints) : undefined}
              hint={
                options.maxDataPoints == null
                  ? t('query-editor-next.details-sidebar.width-of-panel', 'Width of panel')
                  : undefined
              }
            />

            <OptionField
              field={QueryOptionField.minInterval}
              {...inputProps}
              defaultValue={options.minInterval ?? ''}
              placeholder={String(minIntervalOnDs)}
            />

            <OptionField
              field={QueryOptionField.interval}
              defaultValue={realInterval ?? '-'}
              hint={t('query-editor-next.details-sidebar.time-range-max-data-points', 'Time range / max data points')}
              disabled
            />

            <OptionField
              field={QueryOptionField.relativeTime}
              {...inputProps}
              defaultValue={options.timeRange?.from ?? ''}
            />

            <OptionField
              field={QueryOptionField.timeShift}
              {...inputProps}
              defaultValue={options.timeRange?.shift ?? ''}
            />

            {showHideTimeOverride && (
              <OptionField field={QueryOptionField.hideTimeOverride}>
                <Switch
                  value={options.timeRange?.hide ?? false}
                  onChange={handleHideTimeOverrideChange}
                  aria-label={t('query-editor-next.details-sidebar.hide-time-override', 'Hide time info')}
                />
              </OptionField>
            )}

            {showCacheTimeout && (
              <OptionField
                field={QueryOptionField.cacheTimeout}
                {...inputProps}
                defaultValue={options.cacheTimeout ?? ''}
              />
            )}

            {showCacheTTL && (
              <OptionField
                field={QueryOptionField.queryCachingTTL}
                {...inputProps}
                defaultValue={options.queryCachingTTL ?? ''}
                placeholder={dsSettings?.cachingConfig?.TTLMs ? String(dsSettings.cachingConfig.TTLMs) : undefined}
              />
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    content: css({
      flex: 1,
      padding: theme.spacing(1.5),
      overflow: 'auto',
    }),
  };
}

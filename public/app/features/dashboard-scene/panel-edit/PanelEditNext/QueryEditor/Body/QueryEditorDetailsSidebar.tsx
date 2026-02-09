import { css } from '@emotion/css';
import { FocusEvent, useCallback, useRef } from 'react';

import { GrafanaTheme2, rangeUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ClickOutsideWrapper, Stack, useStyles2 } from '@grafana/ui';

import { CONTENT_SIDE_BAR } from '../../constants';
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

  // Shared props for all input-based OptionFields
  const inputProps = { onBlur: handleBlur, focusedField };

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
              field={QueryOptionField.maxDataPoints}
              {...inputProps}
              defaultValue={options.maxDataPoints ?? ''}
              placeholder={realMaxDataPoints ? String(realMaxDataPoints) : undefined}
            />

            <OptionField
              field={QueryOptionField.minInterval}
              {...inputProps}
              defaultValue={options.minInterval ?? ''}
              placeholder={String(minIntervalOnDs)}
            />

            <OptionField field={QueryOptionField.interval}>
              <span className={styles.fieldValue}>{realInterval ?? '-'}</span>
            </OptionField>

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
    fieldValue: css({
      width: CONTENT_SIDE_BAR.labelWidth,
      flexShrink: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      textAlign: 'right',
    }),
  };
}

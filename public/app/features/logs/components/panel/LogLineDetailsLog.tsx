import { css } from '@emotion/css';
import { memo, useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';

import { LogMessageAnsi } from '../LogMessageAnsi';
import { LOG_LINE_BODY_FIELD_NAME } from '../fieldSelector/logFields';

import { HighlightedLogRenderer } from './HighlightedLogRenderer';
import { getStyles } from './LogLine';
import { useLogListContext } from './LogListContext';
import { type LogListModel } from './processing';

interface Props {
  log: LogListModel;
  prettifyJSON?: boolean;
  syntaxHighlighting: boolean;
}

export const LogLineDetailsLog = memo(({ log: originalLog, prettifyJSON, syntaxHighlighting }: Props) => {
  const {
    fontSize,
    noInteractions,
    onClickFilterOutString,
    onClickFilterString,
    onClickShowField,
    onClickHideField,
    displayedFields,
  } = useLogListContext();
  const logStyles = useStyles2(getStyles);
  const styles = useStyles2(getLogLineDetailsLogStyles);
  const log = useMemo(() => {
    const log = originalLog.clone({ prettifyJSON });
    return log;
  }, [originalLog, prettifyJSON]);

  const filterLogLine = useCallback(() => {
    onClickFilterString?.(log.entry, log.dataFrame?.refId);
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_filter_string_clicked', {
        filterType: 'include',
      });
    }
  }, [log.dataFrame?.refId, log.entry, noInteractions, onClickFilterString]);

  const filterOutLogLine = useCallback(() => {
    onClickFilterOutString?.(log.entry, log.dataFrame?.refId);
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_filter_string_clicked', {
        filterType: 'exclude',
      });
    }
  }, [log.dataFrame?.refId, log.entry, noInteractions, onClickFilterOutString]);

  const logLineDisplayed = displayedFields.includes(LOG_LINE_BODY_FIELD_NAME);

  const toggleLogLine = useCallback(() => {
    let action = 'show';
    if (logLineDisplayed) {
      onClickHideField?.(LOG_LINE_BODY_FIELD_NAME);
      action = 'hide';
    } else {
      onClickShowField?.(LOG_LINE_BODY_FIELD_NAME);
    }
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_toggle_log_clicked', { action });
    }
  }, [logLineDisplayed, noInteractions, onClickHideField, onClickShowField]);

  const supportsFilters = onClickFilterString || onClickFilterOutString;
  const showLogLineToggle = onClickHideField && onClickShowField && displayedFields.length > 0;
  const showActions = supportsFilters || showLogLineToggle;

  return (
    <div className={styles.logLineWrapper}>
      <div className={`${logStyles.logLine} ${fontSize === 'small' ? logStyles.fontSizeSmall : ''} ${styles.noHover}`}>
        <div className={logStyles.wrappedLogLine}>
          {showActions && (
            <span className={styles.actions}>
              {onClickFilterString && (
                <IconButton
                  name="search-plus"
                  size={fontSize === 'small' ? 'sm' : undefined}
                  onClick={filterLogLine}
                  tooltip={t('logs.log-line-details.filter-for-log-line', 'Filter for this log line')}
                />
              )}
              {onClickFilterOutString && (
                <IconButton
                  name="search-minus"
                  size={fontSize === 'small' ? 'sm' : undefined}
                  onClick={filterOutLogLine}
                  tooltip={t('logs.log-line-details.filter-out-log-line', 'Filter out this log line')}
                />
              )}
              {showLogLineToggle && (
                <IconButton
                  tooltip={
                    logLineDisplayed
                      ? t('logs.log-line-details.hide-log-line', 'Hide log line')
                      : t('logs.log-line-details.show-log-line', 'Show log line')
                  }
                  tooltipPlacement="top"
                  size="md"
                  name="eye"
                  onClick={toggleLogLine}
                  tabIndex={0}
                  variant={logLineDisplayed ? 'primary' : undefined}
                />
              )}
            </span>
          )}
          {log.hasAnsi ? (
            <span className="field no-highlighting">
              <LogMessageAnsi value={log.body} />
            </span>
          ) : (
            <>
              {!syntaxHighlighting && <span className="field no-highlighting">{log.body}</span>}
              {syntaxHighlighting && (
                <span className="field log-syntax-highlight">
                  {<HighlightedLogRenderer tokens={log.highlightedBodyTokens} />}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

LogLineDetailsLog.displayName = 'LogLineDetailsLog';

const getLogLineDetailsLogStyles = (theme: GrafanaTheme2) => ({
  logLineWrapper: css({
    maxHeight: '50vh',
    overflow: 'auto',
  }),
  actions: css({
    paddingRight: theme.spacing(0.5),
    gap: theme.spacing(0.25),
    display: 'inline-flex',
    alignItems: 'flex-end',
    position: 'relative',
    top: 2.5,
    pointerEvents: 'all',
  }),
  noHover: css({
    // Disable hover style
    pointerEvents: 'none',
  }),
});

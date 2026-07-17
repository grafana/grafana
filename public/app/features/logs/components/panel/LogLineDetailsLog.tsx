import { css } from '@emotion/css';
import { memo, useCallback, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';

import { LogMessageAnsi } from '../LogMessageAnsi';

import { HighlightedLogRenderer } from './HighlightedLogRenderer';
import { getStyles } from './LogLine';
import { useLogListContext } from './LogListContext';
import { type LogListModel } from './processing';

interface Props {
  log: LogListModel;
  syntaxHighlighting: boolean;
}

export const LogLineDetailsLog = memo(({ log: originalLog, syntaxHighlighting }: Props) => {
  const { fontSize, noInteractions, onClickFilterOutString, onClickFilterString } = useLogListContext();
  const logStyles = useStyles2(getStyles);
  const styles = useStyles2(getLogLineDetailsLogStyles);
  const log = useMemo(() => {
    const log = originalLog.clone();
    return log;
  }, [originalLog]);

  const filterLogLine = useCallback(() => {
    onClickFilterString?.(log.entry, log.dataFrame?.refId);
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_filter_string_clicked', {
        datasourceType: log.datasourceType,
        filterType: 'include',
        logRowUid: log.uid,
      });
    }
  }, [log.dataFrame?.refId, log.datasourceType, log.entry, log.uid, noInteractions, onClickFilterString]);

  const filterOutLogLine = useCallback(() => {
    onClickFilterOutString?.(log.entry, log.dataFrame?.refId);
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_filter_string_clicked', {
        datasourceType: log.datasourceType,
        filterType: 'exclude',
        logRowUid: log.uid,
      });
    }
  }, [log.dataFrame?.refId, log.datasourceType, log.entry, log.uid, noInteractions, onClickFilterOutString]);

  const supportsFilters = onClickFilterString || onClickFilterOutString;

  return (
    <div className={styles.logLineWrapper}>
      <div className={`${logStyles.logLine} ${fontSize === 'small' ? logStyles.fontSizeSmall : ''} ${styles.noHover}`}>
        <div className={logStyles.wrappedLogLine}>
          {supportsFilters && (
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

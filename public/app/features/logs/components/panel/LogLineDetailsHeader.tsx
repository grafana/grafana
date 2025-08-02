import { css } from '@emotion/css';
import { useCallback, useMemo, MouseEvent, useRef, ChangeEvent } from 'react';

import { colorManipulator, GrafanaTheme2, LogRowModel, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, Input, useStyles2 } from '@grafana/ui';

import { copyText, handleOpenLogsContextClick } from '../../utils';
import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';

import { LogLineDetailsMode } from './LogLineDetails';
import { useLogIsPinned, useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface Props {
  focusLogLine?: (log: LogListModel) => void;
  log: LogListModel;
  search: string;
  onSearch(newSearch: string): void;
}

export const LogLineDetailsHeader = ({ focusLogLine, log, search, onSearch }: Props) => {
  const {
    closeDetails,
    detailsMode,
    displayedFields,
    getRowContextQuery,
    logOptionsStorageKey,
    logSupportsContext,
    noInteractions,
    setDetailsMode,
    onClickHideField,
    onClickShowField,
    onOpenContext,
    onPermalinkClick,
    onPinLine,
    onUnpinLine,
    wrapLogMessage,
    isAssistantAvailable,
    openAssistantByLog,
  } = useLogListContext();
  const pinned = useLogIsPinned(log);
  const styles = useStyles2(getStyles, detailsMode, wrapLogMessage);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchUsedRef = useRef(false);

  const reportInteractionWrapper = useCallback(
    (interactionName: string, properties?: Record<string, unknown>) => {
      if (noInteractions) {
        return;
      }
      reportInteraction(interactionName, properties);
    },
    [noInteractions]
  );

  const scrollToLogLine = useCallback(() => {
    focusLogLine?.(log);
    reportInteractionWrapper('logs_log_line_details_header_scroll_to_clicked');
  }, [focusLogLine, log]);

  const copyLogLine = useCallback(() => {
    copyText(log.entry, containerRef);
    reportInteractionWrapper('logs_log_line_details_header_copy_clicked');
  }, [log.entry, reportInteractionWrapper]);

  const copyLinkToLogLine = useCallback(() => {
    onPermalinkClick?.(log);
    reportInteractionWrapper('logs_log_line_details_header_permalink_clicked');
  }, [log, onPermalinkClick, reportInteractionWrapper]);

  const togglePinning = useCallback(() => {
    if (pinned) {
      onUnpinLine?.(log);
    } else {
      onPinLine?.(log);
    }
    reportInteractionWrapper('logs_log_line_details_header_pinning_clicked');
  }, [log, onPinLine, onUnpinLine, pinned, reportInteractionWrapper]);

  const shouldlogSupportsContext = useMemo(
    () => (logSupportsContext ? logSupportsContext(log) : false),
    [log, logSupportsContext]
  );

  const showContext = useCallback(
    async (event: MouseEvent<HTMLElement>) => {
      handleOpenLogsContextClick(event, log, getRowContextQuery, (log: LogRowModel) => onOpenContext?.(log, () => {}));
      reportInteractionWrapper('logs_log_line_details_header_context_clicked');
    },
    [log, getRowContextQuery, reportInteractionWrapper, onOpenContext]
  );

  const showLogLineToggle = onClickHideField && onClickShowField && displayedFields.length > 0;
  const logLineDisplayed = displayedFields.includes(LOG_LINE_BODY_FIELD_NAME);

  const toggleDetailsMode = useCallback(() => {
    const newMode = detailsMode === 'inline' ? 'sidebar' : 'inline';
    if (logOptionsStorageKey) {
      store.set(`${logOptionsStorageKey}.detailsMode`, newMode);
    }

    setDetailsMode(newMode);
  }, [detailsMode, logOptionsStorageKey, setDetailsMode]);

  const toggleLogLine = useCallback(() => {
    if (logLineDisplayed) {
      onClickHideField?.(LOG_LINE_BODY_FIELD_NAME);
    } else {
      onClickShowField?.(LOG_LINE_BODY_FIELD_NAME);
    }
    reportInteractionWrapper('logs_log_line_details_header_show_logline_clicked');
  }, [logLineDisplayed, onClickHideField, onClickShowField, reportInteractionWrapper]);

  const clearSearch = useMemo(
    () => (
      <IconButton
        name="times"
        size="sm"
        onClick={() => {
          onSearch('');
          reportInteractionWrapper('logs_log_line_details_header_search_cleared');
          if (inputRef.current) {
            inputRef.current.value = '';
          }
        }}
        tooltip={t('logs.log-line-details.clear-search', 'Clear')}
      />
    ),
    [onSearch, reportInteractionWrapper]
  );

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
      if (!searchUsedRef.current) {
        reportInteractionWrapper('logs_log_line_details_header_search_used');
        searchUsedRef.current = true;
      }
    },
    [onSearch, reportInteractionWrapper]
  );

  return (
    <div className={styles.header} ref={containerRef}>
      <Input
        onChange={handleSearch}
        placeholder={t('logs.log-line-details.search-placeholder', 'Search field names and values')}
        ref={inputRef}
        suffix={search !== '' ? clearSearch : undefined}
      />
      <div className={styles.icons}>
        {isAssistantAvailable && (
          <IconButton
            tooltip={t('logs.log-line-details.open-assistant', 'Explain this log line in Assistant')}
            tooltipPlacement="top"
            size="md"
            name="ai-sparkle"
            onClick={() => openAssistantByLog?.(log)}
            tabIndex={0}
          />
        )}
        {focusLogLine && (
          <IconButton
            tooltip={t('logs.log-line-details.scroll-to-logline', 'Scroll to log line')}
            tooltipPlacement="top"
            size="md"
            name="arrows-v"
            onClick={scrollToLogLine}
            tabIndex={0}
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
        <IconButton
          tooltip={t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard')}
          tooltipPlacement="top"
          size="md"
          name="copy"
          onClick={copyLogLine}
          tabIndex={0}
        />
        {onPermalinkClick && log.rowId !== undefined && log.uid && (
          <IconButton
            tooltip={t('logs.log-line-details.copy-shortlink', 'Copy shortlink')}
            tooltipPlacement="top"
            size="md"
            name="share-alt"
            onClick={copyLinkToLogLine}
            tabIndex={0}
          />
        )}
        {pinned && onUnpinLine && (
          <IconButton
            size="md"
            name="gf-pin"
            onClick={togglePinning}
            tooltip={t('logs.log-line-details.unpin-line', 'Unpin log')}
            tooltipPlacement="top"
            tabIndex={0}
            variant="primary"
          />
        )}
        {!pinned && onPinLine && (
          <IconButton
            size="md"
            name="gf-pin"
            onClick={togglePinning}
            tooltip={t('logs.log-line-details.pin-line', 'Pin log')}
            tooltipPlacement="top"
            tabIndex={0}
          />
        )}
        {shouldlogSupportsContext && (
          <IconButton
            size="md"
            name="gf-show-context"
            onClick={showContext}
            tooltip={t('logs.log-line-details.show-context', 'Show context')}
            tooltipPlacement="top"
            tabIndex={0}
          />
        )}
        <IconButton
          name={detailsMode === 'inline' ? 'columns' : 'gf-layout-simple'}
          tooltip={
            detailsMode === 'inline'
              ? t('logs.log-line-details.sidebar-mode', 'Anchor to the right')
              : t('logs.log-line-details.inline-mode', 'Display inline')
          }
          onClick={toggleDetailsMode}
        />
        <IconButton
          name="times"
          aria-label={t('logs.log-line-details.close', 'Close log details')}
          onClick={closeDetails}
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, mode: LogLineDetailsMode, wrapLogMessage: boolean) => ({
  container: css({
    overflow: 'auto',
    height: '100%',
  }),
  scrollContainer: css({
    overflow: 'auto',
    height: '100%',
  }),
  header: css({
    alignItems: 'center',
    background: theme.colors.background.canvas,
    display: 'flex',
    flexDirection: !wrapLogMessage && mode === 'inline' ? 'row-reverse' : 'row',
    gap: theme.spacing(0.75),
    zIndex: theme.zIndex.navbarFixed,
    height: theme.spacing(5.5),
    marginBottom: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    position: 'sticky',
    top: 0,
  }),
  icons: css({
    display: 'flex',
    gap: theme.spacing(0.75),
  }),
  copyLogButton: css({
    padding: 0,
    height: theme.spacing(4),
    width: theme.spacing(2.5),
    overflow: 'hidden',
    '&:hover': {
      backgroundColor: colorManipulator.alpha(theme.colors.text.primary, 0.12),
    },
  }),
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});

import { css } from '@emotion/css';
import { useCallback, useMemo, MouseEvent, useRef } from 'react';

import { colorManipulator, GrafanaTheme2, LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Input, useStyles2 } from '@grafana/ui';

import { copyText, handleOpenLogsContextClick } from '../../utils';

import { useLogIsPinned, useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface Props {
  log: LogListModel;
}

export const LogLineDetailsHeader = ({ log }: Props) => {
  const {
    closeDetails,
    getRowContextQuery,
    logSupportsContext,
    onOpenContext,
    onPermalinkClick,
    onPinLine,
    onUnpinLine,
  } = useLogListContext();
  const pinned = useLogIsPinned(log);
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const copyLogLine = useCallback(() => {
    copyText(log.entry, containerRef);
  }, [log.entry]);

  const copyLinkToLogLine = useCallback(() => {
    onPermalinkClick?.(log);
  }, [log, onPermalinkClick]);

  const togglePinning = useCallback(() => {
    if (pinned) {
      onUnpinLine?.(log);
    } else {
      onPinLine?.(log);
    }
  }, [log, onPinLine, onUnpinLine, pinned]);

  const shouldlogSupportsContext = useMemo(
    () => (logSupportsContext ? logSupportsContext(log) : false),
    [log, logSupportsContext]
  );

  const showContext = useCallback(
    async (event: MouseEvent<HTMLElement>) => {
      handleOpenLogsContextClick(event, log, getRowContextQuery, (log: LogRowModel) => onOpenContext?.(log, () => {}));
    },
    [onOpenContext, getRowContextQuery, log]
  );

  return (
    <div className={styles.header} ref={containerRef}>
      <Input placeholder={t('logs.log-line-details.search-placeholder', 'Search field names and values')} />
      <IconButton
        tooltip={t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard')}
        aria-label={t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard')}
        tooltipPlacement="top"
        size="md"
        name="copy"
        onClick={copyLogLine}
        tabIndex={0}
      />
      {onPermalinkClick && log.rowId !== undefined && log.uid && (
        <IconButton
          tooltip={t('logs.log-line-details.copy-shortlink', 'Copy shortlink')}
          aria-label={t('logs.log-line-details.copy-shortlink', 'Copy shortlink')}
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
          aria-label={t('logs.log-line-details.unpin-line', 'Unpin line')}
          tabIndex={0}
          variant="primary"
        />
      )}
      {!pinned && onPinLine && (
        <IconButton
          size="md"
          name="gf-pin"
          onClick={togglePinning}
          tooltip={t('logs.log-line-details.unpin-line', 'Pin log')}
          tooltipPlacement="top"
          aria-label={t('logs.log-line-details.pin-line', 'Pin line')}
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
          aria-label={t('logs.log-line-details.show-context', 'Show context')}
          tabIndex={0}
        />
      )}
      <IconButton
        name="times"
        aria-label={t('logs.log-line-details.close', 'Close log details')}
        onClick={closeDetails}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    overflow: 'auto',
    height: '100%',
  }),
  scrollContainer: css({
    overflow: 'auto',
    height: '100%',
  }),
  header: css({
    background: theme.colors.background.primary,
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(0.75),
    zIndex: theme.zIndex.modal,
    height: theme.spacing(5),
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    position: 'sticky',
    top: 0,
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

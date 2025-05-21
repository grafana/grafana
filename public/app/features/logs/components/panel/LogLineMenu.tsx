import { useCallback, useMemo, useRef, MouseEvent } from 'react';

import { LogRowContextOptions, LogRowModel } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Dropdown, IconButton, Menu } from '@grafana/ui';

import { copyText, handleOpenLogsContextClick } from '../../utils';

import { LogLineStyles } from './LogLine';
import { useLogIsPinned, useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

export type GetRowContextQueryFn = (
  row: LogRowModel,
  options?: LogRowContextOptions,
  cacheFilters?: boolean
) => Promise<DataQuery | null>;

interface Props {
  log: LogListModel;
  styles: LogLineStyles;
}

export const LogLineMenu = ({ log, styles }: Props) => {
  const {
    enableLogDetails,
    detailsDisplayed,
    getRowContextQuery,
    onOpenContext,
    onPermalinkClick,
    onPinLine,
    onUnpinLine,
    logSupportsContext,
    toggleDetails,
  } = useLogListContext();
  const pinned = useLogIsPinned(log);
  const menuRef = useRef(null);

  const copyLogLine = useCallback(() => {
    copyText(log.entry, menuRef);
  }, [log.entry]);

  const copyLinkToLogLine = useCallback(() => {
    onPermalinkClick?.(log);
  }, [log, onPermalinkClick]);

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

  const toggleLogDetails = useCallback(() => {
    toggleDetails(log);
  }, [log, toggleDetails]);

  const togglePinning = useCallback(() => {
    if (pinned) {
      onUnpinLine?.(log);
    } else {
      onPinLine?.(log);
    }
  }, [log, onPinLine, onUnpinLine, pinned]);

  const { t } = useTranslate();

  const menu = useCallback(
    () => (
      <Menu ref={menuRef}>
        {enableLogDetails && (
          <Menu.Item
            onClick={toggleLogDetails}
            label={
              detailsDisplayed(log)
                ? t('logs.log-line-menu.show-details', 'Hide log details')
                : t('logs.log-line-menu.hide-details', 'Show log details')
            }
          />
        )}
        {shouldlogSupportsContext && (
          <Menu.Item onClick={showContext} label={t('logs.log-line-menu.show-context', 'Show context')} />
        )}
        {!pinned && onPinLine && (
          <Menu.Item onClick={togglePinning} label={t('logs.log-line-menu.pin-to-outline', 'Pin log')} />
        )}
        {pinned && onUnpinLine && (
          <Menu.Item onClick={togglePinning} label={t('logs.log-line-menu.unpin-from-outline', 'Unpin log')} />
        )}
        <Menu.Divider />
        <Menu.Item onClick={copyLogLine} label={t('logs.log-line-menu.copy-log', 'Copy log line')} />
        {onPermalinkClick && log.rowId !== undefined && log.uid && (
          <Menu.Item onClick={copyLinkToLogLine} label={t('logs.log-line-menu.copy-link', 'Copy link to log line')} />
        )}
      </Menu>
    ),
    [
      copyLinkToLogLine,
      copyLogLine,
      detailsDisplayed,
      enableLogDetails,
      log,
      onPermalinkClick,
      onPinLine,
      onUnpinLine,
      pinned,
      shouldlogSupportsContext,
      showContext,
      t,
      toggleLogDetails,
      togglePinning,
    ]
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start">
      <IconButton
        className={styles.menuIcon}
        name="ellipsis-v"
        aria-label={t('logs.log-line-menu.icon-label', 'Log menu')}
      />
    </Dropdown>
  );
};

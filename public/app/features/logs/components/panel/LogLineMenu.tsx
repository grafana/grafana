import { useCallback, useMemo, useRef, MouseEvent } from 'react';

import { LogRowContextOptions, LogRowModel } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
  const { getRowContextQuery, onOpenContext, onPermalinkClick, onPinLine, onUnpinLine, logSupportsContext } =
    useLogListContext();
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

  const togglePinning = useCallback(() => {
    if (pinned) {
      onUnpinLine?.(log);
    } else {
      onPinLine?.(log);
    }
  }, [log, onPinLine, onUnpinLine, pinned]);

  const menu = useCallback(
    () => (
      <Menu ref={menuRef}>
        <Menu.Item onClick={copyLogLine} label={t('logs.log-line-menu.copy-log', 'Copy log line')} />
        {onPermalinkClick && log.rowId !== undefined && log.uid && (
          <Menu.Item onClick={copyLinkToLogLine} label={t('logs.log-line-menu.copy-link', 'Copy link to log line')} />
        )}
        {(shouldlogSupportsContext || onPinLine || onUnpinLine) && <Menu.Divider />}
        {shouldlogSupportsContext && (
          <Menu.Item onClick={showContext} label={t('logs.log-line-menu.show-context', 'Show context')} />
        )}
        {!pinned && onPinLine && (
          <Menu.Item onClick={togglePinning} label={t('logs.log-line-menu.pin-to-outline', 'Pin log')} />
        )}
        {pinned && onUnpinLine && (
          <Menu.Item onClick={togglePinning} label={t('logs.log-line-menu.unpin-from-outline', 'Unpin log')} />
        )}
      </Menu>
    ),
    [
      copyLinkToLogLine,
      copyLogLine,
      log.rowId,
      log.uid,
      onPermalinkClick,
      onPinLine,
      onUnpinLine,
      pinned,
      shouldlogSupportsContext,
      showContext,
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

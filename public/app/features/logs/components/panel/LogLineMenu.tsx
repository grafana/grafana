import { useCallback, useMemo, useRef, MouseEvent } from 'react';

import { LogRowContextOptions, LogRowModel } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Dropdown, IconButton, Menu, PopoverContent } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { copyText, handleOpenLogsContextClick } from '../../utils';

import { LogLineStyles } from './LogLine';
import { LogListModel } from './processing';

export type GetRowContextQueryFn = (
  row: LogRowModel,
  options?: LogRowContextOptions,
  cacheFilters?: boolean
) => Promise<DataQuery | null>;

interface Props {
  getRowContextQuery?: GetRowContextQueryFn;
  log: LogListModel;
  styles: LogLineStyles;
  showContextToggle?: (row: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinned?: boolean;
}

export const LogLineMenu = ({
  getRowContextQuery,
  log,
  onOpenContext,
  onPermalinkClick,
  onPinLine,
  onUnpinLine,
  pinned,
  showContextToggle,
  styles,
}: Props) => {
  const menuRef = useRef(null);

  const copyLogLine = useCallback(() => {
    copyText(log.entry, menuRef);
  }, [log.entry]);

  const shouldShowContextToggle = useMemo(
    () => (showContextToggle ? showContextToggle(log) : false),
    [log, showContextToggle]
  );

  const showContext = useCallback(
    async (event: MouseEvent<HTMLElement>) => {
      if (getRowContextQuery) {
        handleOpenLogsContextClick(event, log, getRowContextQuery, onOpenContext);
      }
    },
    [onOpenContext, getRowContextQuery, log]
  );

  const menu = useCallback(
    () => (
      <Menu ref={menuRef}>
        <Menu.Item onClick={copyLogLine} label={t('logs.log-line-menu.copy-log', 'Copy log line')} />
        {onPermalinkClick && log.rowId !== undefined && log.uid && (
          <Menu.Item label={t('logs.log-line-menu.copy-link', 'Copy link to log line')} />
        )}
        {(shouldShowContextToggle || onPinLine || onUnpinLine) && <Menu.Divider />}
        {shouldShowContextToggle && (
          <Menu.Item onClick={showContext} label={t('logs.log-line-menu.show-context', 'Show context')} />
        )}
        {!pinned && onPinLine && <Menu.Item label={t('logs.log-line-menu.pin-to-outline', 'Pin line')} />}
        {pinned && onUnpinLine && <Menu.Item label={t('logs.log-line-menu.pin-to-outline', 'Unpin line')} />}
      </Menu>
    ),
    [
      copyLogLine,
      log.rowId,
      log.uid,
      onPermalinkClick,
      onPinLine,
      onUnpinLine,
      pinned,
      shouldShowContextToggle,
      showContext,
    ]
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start">
      <IconButton className={styles.menuIcon} name="ellipsis-v" aria-label="Log menu" />
    </Dropdown>
  );
};

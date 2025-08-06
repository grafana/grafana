import { MouseEvent, useCallback, useMemo, useRef } from 'react';

import { LogRowContextOptions, LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
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

type MenuItem = {
  label: string;
  onClick(log: LogListModel): void;
};

type MenuItemDivider = {
  divider: true;
};

export type LogLineMenuCustomItem = MenuItem | MenuItemDivider;

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
    logLineMenuCustomItems = [],
    logSupportsContext,
    setTimestampFormat,
    timestampFormat,
    toggleDetails,
    isAssistantAvailable,
    openAssistantByLog,
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

  const toggleTimestampFormat = useCallback(() => {
    setTimestampFormat(timestampFormat === 'ms' ? 'ns' : 'ms');
    reportInteraction(`logs_log_line_menu_toggle_timestamp_format`, {
      format: timestampFormat === 'ms' ? 'ns' : 'ms',
    });
  }, [setTimestampFormat, timestampFormat]);

  const togglePinning = useCallback(() => {
    if (pinned) {
      onUnpinLine?.(log);
    } else {
      onPinLine?.(log);
    }
  }, [log, onPinLine, onUnpinLine, pinned]);

  const showFirstDivider = enableLogDetails || shouldlogSupportsContext || onPinLine || onUnpinLine;
  const nsPresent = useMemo(() => log.timeEpochNs.endsWith('000000') === false, [log.timeEpochNs]);

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
        {nsPresent && (
          <>
            <Menu.Divider />
            <Menu.Item
              onClick={toggleTimestampFormat}
              label={
                timestampFormat === 'ms'
                  ? t('logs.log-line-menu.timestamp-ns', 'Show nanoseconds')
                  : t('logs.log-line-menu.timestamp-ms', 'Show milliseconds')
              }
            />
          </>
        )}
        {showFirstDivider && <Menu.Divider />}
        <Menu.Item onClick={copyLogLine} label={t('logs.log-line-menu.copy-log', 'Copy log line')} />
        {onPermalinkClick && log.rowId !== undefined && log.uid && (
          <Menu.Item onClick={copyLinkToLogLine} label={t('logs.log-line-menu.copy-link', 'Copy link to log line')} />
        )}
        {logLineMenuCustomItems.map((item, i) => {
          if (isDivider(item)) {
            return <Menu.Divider key={i} />;
          }
          if (isItem(item)) {
            return <Menu.Item onClick={() => item.onClick(log)} label={item.label} key={i} />;
          }
          return null;
        })}
        {isAssistantAvailable && (
          <>
            <Menu.Divider />
            <Menu.Item
              onClick={() => openAssistantByLog?.(log)}
              icon="ai-sparkle"
              label={t('logs.log-line-menu.open-assistant', 'Explain this log line in Assistant')}
            />
          </>
        )}
      </Menu>
    ),
    [
      copyLinkToLogLine,
      copyLogLine,
      detailsDisplayed,
      enableLogDetails,
      isAssistantAvailable,
      log,
      logLineMenuCustomItems,
      nsPresent,
      onPermalinkClick,
      onPinLine,
      onUnpinLine,
      openAssistantByLog,
      pinned,
      shouldlogSupportsContext,
      showContext,
      showFirstDivider,
      timestampFormat,
      toggleLogDetails,
      togglePinning,
      toggleTimestampFormat,
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

function isDivider(item: LogLineMenuCustomItem) {
  return 'divider' in item && item.divider;
}

function isItem(item: LogLineMenuCustomItem) {
  return 'onClick' in item && 'label' in item;
}

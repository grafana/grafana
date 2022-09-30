import { css, cx } from '@emotion/css';
import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

import { GrafanaTheme2, DataQueryError, LogRowModel, textUtil, LogsSortOrder } from '@grafana/data';
import { useStyles2, Alert, ClickOutsideWrapper, CustomScrollbar, List, Button } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowContextRows, LogRowContextQueryErrors, HasMoreContextRows } from './LogRowContextProvider';

export enum LogGroupPosition {
  Bottom = 'bottom',
  Top = 'top',
}

interface LogRowContextProps {
  row: LogRowModel;
  context: LogRowContextRows;
  wrapLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  hasMoreContextRows?: HasMoreContextRows;
  logsSortOrder?: LogsSortOrder | null;
  onOutsideClick: () => void;
  onLoadMoreContext: () => void;
}

const getLogRowContextStyles = (theme: GrafanaTheme2, wrapLogMessage?: boolean) => {
  /**
   * This is workaround for displaying uncropped context when we have unwrapping log messages.
   * We are using margins to correctly position context. Because non-wrapped logs have always 1 line of log
   * and 1 line of Show/Hide context switch. Therefore correct position can be reliably achieved by margins.
   * We also adjust width to 75%.
   */

  const headerHeight = 40;
  const logsHeight = 220;
  const contextHeight = headerHeight + logsHeight;
  const afterContext = wrapLogMessage
    ? css`
        top: -${contextHeight}px;
      `
    : css`
        margin-top: -${contextHeight}px;
        width: 75%;
      `;

  const beforeContext = wrapLogMessage
    ? css`
        top: 100%;
      `
    : css`
        margin-top: 20px;
        width: 75%;
      `;
  return {
    commonStyles: css`
      position: absolute;
      height: ${contextHeight}px;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      background: ${theme.colors.background.primary};
      box-shadow: 0 0 10px ${theme.v1.palette.black};
      border: 1px solid ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius(2)};
      width: 100%;
    `,
    header: css`
      height: ${headerHeight}px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      background: ${theme.colors.background.secondary};
    `,
    headerButton: css`
      margin-left: 8px;
    `,
    logs: css`
      height: ${logsHeight}px;
      padding: 10px;

      .scrollbar-view {
        overscroll-behavior: contain;
      }
    `,
    afterContext,
    beforeContext,
  };
};

interface LogRowContextGroupHeaderProps {
  row: LogRowModel;
  rows: Array<string | DataQueryError>;
  onLoadMoreContext: () => void;
  groupPosition: LogGroupPosition;
  shouldScrollToBottom?: boolean;
  canLoadMoreRows?: boolean;
  logsSortOrder?: LogsSortOrder | null;
}
interface LogRowContextGroupProps extends LogRowContextGroupHeaderProps {
  rows: Array<string | DataQueryError>;
  groupPosition: LogGroupPosition;
  className?: string;
  error?: string;
  logsSortOrder?: LogsSortOrder | null;
}

const LogRowContextGroupHeader: React.FunctionComponent<LogRowContextGroupHeaderProps> = ({
  row,
  rows,
  onLoadMoreContext,
  canLoadMoreRows,
  groupPosition,
  logsSortOrder,
}) => {
  const { header, headerButton } = useStyles2(getLogRowContextStyles);

  // determine the position in time for this LogGroup by taking the ordering of
  // logs and position of the component itself into account.
  let logGroupPosition = 'after';
  if (groupPosition === LogGroupPosition.Bottom) {
    if (logsSortOrder === LogsSortOrder.Descending) {
      logGroupPosition = 'before';
    }
  } else if (logsSortOrder === LogsSortOrder.Ascending) {
    logGroupPosition = 'before';
  }

  return (
    <div className={header}>
      <span
        className={css`
          opacity: 0.6;
        `}
      >
        Showing {rows.length} lines {logGroupPosition} match.
      </span>
      {(rows.length >= 10 || (rows.length > 10 && rows.length % 10 !== 0)) && canLoadMoreRows && (
        <Button className={headerButton} variant="secondary" size="sm" onClick={onLoadMoreContext}>
          Load 10 more lines
        </Button>
      )}
    </div>
  );
};

export const LogRowContextGroup: React.FunctionComponent<LogRowContextGroupProps> = ({
  row,
  rows,
  error,
  className,
  shouldScrollToBottom,
  canLoadMoreRows,
  onLoadMoreContext,
  groupPosition,
  logsSortOrder,
}) => {
  const { commonStyles, logs } = useStyles2(getLogRowContextStyles);
  const [scrollTop, setScrollTop] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // We want to scroll to bottom only when we receive first 10 log lines
    const shouldScrollRows = rows.length > 0 && rows.length <= 10;
    if (shouldScrollToBottom && shouldScrollRows && listContainerRef.current) {
      setScrollTop(listContainerRef.current.offsetHeight);
    }
  }, [shouldScrollToBottom, rows]);

  const headerProps = {
    row,
    rows,
    onLoadMoreContext,
    canLoadMoreRows,
    groupPosition,
    logsSortOrder,
  };

  return (
    <div className={cx(commonStyles, className)}>
      {/* When displaying "after" context */}
      {shouldScrollToBottom && !error && <LogRowContextGroupHeader {...headerProps} />}
      <div className={logs}>
        <CustomScrollbar autoHide scrollTop={scrollTop} autoHeightMin={'210px'}>
          <div ref={listContainerRef}>
            {!error && (
              <List
                items={rows}
                renderItem={(item) => {
                  return (
                    <div
                      className={css`
                        padding: 5px 0;
                      `}
                    >
                      {typeof item === 'string' && textUtil.hasAnsiCodes(item) ? <LogMessageAnsi value={item} /> : item}
                    </div>
                  );
                }}
              />
            )}
            {error && <Alert title={error} />}
          </div>
        </CustomScrollbar>
      </div>
      {/* When displaying "before" context */}
      {!shouldScrollToBottom && !error && <LogRowContextGroupHeader {...headerProps} />}
    </div>
  );
};

export const LogRowContext: React.FunctionComponent<LogRowContextProps> = ({
  row,
  context,
  errors,
  onOutsideClick,
  onLoadMoreContext,
  hasMoreContextRows,
  wrapLogMessage,
  logsSortOrder,
}) => {
  useEffect(() => {
    const handleEscKeyDown = (e: KeyboardEvent): void => {
      if (e.keyCode === 27) {
        onOutsideClick();
      }
    };
    document.addEventListener('keydown', handleEscKeyDown, false);
    return () => {
      document.removeEventListener('keydown', handleEscKeyDown, false);
    };
  }, [onOutsideClick]);
  const { afterContext, beforeContext } = useStyles2((theme) => getLogRowContextStyles(theme, wrapLogMessage));

  return (
    <ClickOutsideWrapper onClick={onOutsideClick}>
      {/* e.stopPropagation is necessary so the log details doesn't open when clicked on log line in context
       * and/or when context log line is being highlighted */}
      <div onClick={(e) => e.stopPropagation()}>
        {context.after && (
          <LogRowContextGroup
            rows={context.after}
            error={errors && errors.after}
            row={row}
            className={afterContext}
            shouldScrollToBottom
            canLoadMoreRows={hasMoreContextRows ? hasMoreContextRows.after : false}
            onLoadMoreContext={onLoadMoreContext}
            groupPosition={LogGroupPosition.Top}
            logsSortOrder={logsSortOrder}
          />
        )}

        {context.before && (
          <LogRowContextGroup
            onLoadMoreContext={onLoadMoreContext}
            canLoadMoreRows={hasMoreContextRows ? hasMoreContextRows.before : false}
            row={row}
            rows={context.before}
            error={errors && errors.before}
            className={beforeContext}
            groupPosition={LogGroupPosition.Bottom}
            logsSortOrder={logsSortOrder}
          />
        )}
      </div>
    </ClickOutsideWrapper>
  );
};

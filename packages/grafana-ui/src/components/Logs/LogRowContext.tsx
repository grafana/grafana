import { css, cx } from '@emotion/css';
import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

import { GrafanaTheme2, DataQueryError, LogRowModel, textUtil } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { List } from '../List/List';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowContextRows, LogRowContextQueryErrors, HasMoreContextRows } from './LogRowContextProvider';

interface LogRowContextProps {
  row: LogRowModel;
  context: LogRowContextRows;
  wrapLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  hasMoreContextRows?: HasMoreContextRows;
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

  const afterContext = wrapLogMessage
    ? css`
        top: -250px;
      `
    : css`
        margin-top: -250px;
        width: 75%;
      `;

  const beforeContext = wrapLogMessage
    ? css`
        top: 100%;
      `
    : css`
        margin-top: 40px;
        width: 75%;
      `;
  return {
    commonStyles: css`
      position: absolute;
      height: 250px;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      background: ${theme.colors.background.primary};
      box-shadow: 0 0 10px ${theme.v1.palette.black};
      border: 1px solid ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      width: 100%;
    `,
    header: css`
      height: 30px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      background: ${theme.colors.background.secondary};
    `,
    logs: css`
      height: 220px;
      padding: 10px;
    `,
    afterContext,
    beforeContext,
  };
};

interface LogRowContextGroupHeaderProps {
  row: LogRowModel;
  rows: Array<string | DataQueryError>;
  onLoadMoreContext: () => void;
  shouldScrollToBottom?: boolean;
  canLoadMoreRows?: boolean;
}
interface LogRowContextGroupProps extends LogRowContextGroupHeaderProps {
  rows: Array<string | DataQueryError>;
  className?: string;
  error?: string;
}

const LogRowContextGroupHeader = ({ row, rows, onLoadMoreContext, canLoadMoreRows }: LogRowContextGroupHeaderProps) => {
  const { header } = useStyles2(getLogRowContextStyles);

  return (
    <div className={header}>
      <span
        className={css`
          opacity: 0.6;
        `}
      >
        Found {rows.length} rows.
      </span>
      {(rows.length >= 10 || (rows.length > 10 && rows.length % 10 !== 0)) && canLoadMoreRows && (
        <span
          className={css`
            margin-left: 10px;
            &:hover {
              text-decoration: underline;
              cursor: pointer;
            }
          `}
          onClick={onLoadMoreContext}
        >
          Load 10 more
        </span>
      )}
    </div>
  );
};

/** @deprecated will be removed in the next major version */
export const LogRowContextGroup = ({
  row,
  rows,
  error,
  className,
  shouldScrollToBottom,
  canLoadMoreRows,
  onLoadMoreContext,
}: LogRowContextGroupProps) => {
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
                  const message = typeof item === 'string' ? item : item.message ?? '';
                  return (
                    <div
                      className={css`
                        padding: 5px 0;
                      `}
                    >
                      {textUtil.hasAnsiCodes(message) ? <LogMessageAnsi value={message} /> : message}
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

/** @deprecated will be removed in the next major version */
export const LogRowContext = ({
  row,
  context,
  errors,
  onOutsideClick,
  onLoadMoreContext,
  hasMoreContextRows,
  wrapLogMessage,
}: LogRowContextProps) => {
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
          />
        )}
      </div>
    </ClickOutsideWrapper>
  );
};

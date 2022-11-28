import { css, cx } from '@emotion/css';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import { DataQueryError, GrafanaTheme2, LogRowModel, textUtil } from '@grafana/data';
import { Alert, ClickOutsideWrapper, CustomScrollbar, List, useStyles2 } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { HasMoreContextRows, LogRowContextQueryErrors, LogRowContextRows } from './LogRowContextProvider';

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
        margin-top: 20px;
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
      border-radius: ${theme.shape.borderRadius(2)};
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
  shouldScrollToBottom?: boolean;
  canLoadMoreRows?: boolean;
}
interface LogRowContextGroupProps extends LogRowContextGroupHeaderProps {
  rows: Array<string | DataQueryError>;
  className?: string;
  error?: string;
}

const LogRowContextGroupHeader: React.FunctionComponent<LogRowContextGroupHeaderProps> = ({
  row,
  rows,
  onLoadMoreContext,
  canLoadMoreRows,
}) => {
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

export const LogRowContextGroup: React.FunctionComponent<LogRowContextGroupProps> = ({
  row,
  rows,
  error,
  className,
  shouldScrollToBottom,
  canLoadMoreRows,
  onLoadMoreContext,
}) => {
  const { commonStyles, logs } = useStyles2(getLogRowContextStyles);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevRows = usePrevious(rows);
  const prevScrollTop = usePrevious(scrollTop);
  const prevScrollHeight = usePrevious(scrollHeight);

  /**
   * This hook is responsible of keeping the right scroll position of the top
   * context when rows are added. Since rows are added at the top of the DOM,
   * the scroll position changes and we need to adjust the scrollTop.
   */
  useLayoutEffect(() => {
    if (!shouldScrollToBottom || !listContainerRef.current) {
      return;
    }

    const previousRowsLength = prevRows?.length ?? 0;
    const previousScrollHeight = prevScrollHeight ?? 0;
    const previousScrollTop = prevScrollTop ?? 0;
    const scrollElement = listContainerRef.current.parentElement;
    let currentScrollHeight = 0;

    if (scrollElement) {
      currentScrollHeight = scrollElement.scrollHeight - scrollElement.clientHeight;
      setScrollHeight(currentScrollHeight);
    }

    if (rows.length > previousRowsLength && currentScrollHeight > previousScrollHeight) {
      setScrollTop(previousScrollTop + (currentScrollHeight - previousScrollHeight));
    }
  }, [shouldScrollToBottom, rows, prevRows, prevScrollTop, prevScrollHeight]);

  /**
   * Keeps track of the scroll position of the list container.
   */
  const updateScroll = () => {
    const scrollElement = listContainerRef.current?.parentElement;
    if (scrollElement) {
      setScrollTop(listContainerRef.current?.parentElement.scrollTop);
    }
  };

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
        <CustomScrollbar autoHide onScroll={updateScroll} scrollTop={scrollTop} autoHeightMin={'210px'}>
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

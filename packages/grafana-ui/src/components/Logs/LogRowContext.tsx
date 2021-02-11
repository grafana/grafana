import React, { useContext, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { GrafanaTheme, DataQueryError, LogRowModel } from '@grafana/data';
import { css, cx } from 'emotion';

import { Alert } from '../Alert/Alert';
import { LogRowContextRows, LogRowContextQueryErrors, HasMoreContextRows } from './LogRowContextProvider';
import { ThemeContext } from '../../themes/ThemeContext';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { List } from '../List/List';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

interface LogRowContextProps {
  row: LogRowModel;
  context: LogRowContextRows;
  errors?: LogRowContextQueryErrors;
  hasMoreContextRows?: HasMoreContextRows;
  onOutsideClick: () => void;
  onLoadMoreContext: () => void;
}

const getLogRowContextStyles = (theme: GrafanaTheme) => {
  return {
    commonStyles: css`
      position: absolute;
      width: calc(100% + 20px);
      left: -13px;
      height: 250px;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      background: ${theme.colors.bg1};
      box-shadow: 0 0 10px ${theme.colors.dropdownShadow};
      border: 1px solid ${theme.colors.bg2};
      border-radius: ${theme.border.radius.md};
    `,
    header: css`
      height: 30px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      background: ${theme.colors.bg2};
    `,
    logs: css`
      height: 220px;
      padding: 10px;
    `,
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
  className: string;
  error?: string;
}

const LogRowContextGroupHeader: React.FunctionComponent<LogRowContextGroupHeaderProps> = ({
  row,
  rows,
  onLoadMoreContext,
  canLoadMoreRows,
}) => {
  const theme = useContext(ThemeContext);
  const { header } = getLogRowContextStyles(theme);

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

const LogRowContextGroup: React.FunctionComponent<LogRowContextGroupProps> = ({
  row,
  rows,
  error,
  className,
  shouldScrollToBottom,
  canLoadMoreRows,
  onLoadMoreContext,
}) => {
  const theme = useContext(ThemeContext);
  const { commonStyles, logs } = getLogRowContextStyles(theme);
  const [scrollTop, setScrollTop] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;

  useLayoutEffect(() => {
    if (shouldScrollToBottom && listContainerRef.current) {
      setScrollTop(listContainerRef.current.offsetHeight);
    }
  }, [shouldScrollToBottom]);

  const headerProps = {
    row,
    rows,
    onLoadMoreContext,
    canLoadMoreRows,
  };

  return (
    <div className={cx(className, commonStyles)}>
      {/* When displaying "after" context */}
      {shouldScrollToBottom && !error && <LogRowContextGroupHeader {...headerProps} />}
      <div className={logs}>
        <CustomScrollbar autoHide scrollTop={scrollTop}>
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
                      {item}
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
            className={css`
              top: -250px;
            `}
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
            className={css`
              top: 100%;
            `}
          />
        )}
      </div>
    </ClickOutsideWrapper>
  );
};

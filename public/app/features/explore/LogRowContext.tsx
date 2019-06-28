import React, { useContext, useRef, useState, useLayoutEffect } from 'react';
import {
  ThemeContext,
  List,
  GrafanaTheme,
  selectThemeVariant,
  ClickOutsideWrapper,
  CustomScrollbar,
  DataQueryError,
  LogRowModel,
} from '@grafana/ui';
import { css, cx } from 'emotion';
import { LogRowContextRows, HasMoreContextRows, LogRowContextQueryErrors } from './LogRowContextProvider';
import { Alert } from './Error';

interface LogRowContextProps {
  row: LogRowModel;
  context: LogRowContextRows;
  errors?: LogRowContextQueryErrors;
  hasMoreContextRows: HasMoreContextRows;
  onOutsideClick: () => void;
  onLoadMoreContext: () => void;
}

const getLogRowContextStyles = (theme: GrafanaTheme) => {
  const gradientTop = selectThemeVariant(
    {
      light: theme.colors.white,
      dark: theme.colors.dark1,
    },
    theme.type
  );
  const gradientBottom = selectThemeVariant(
    {
      light: theme.colors.gray7,
      dark: theme.colors.dark2,
    },
    theme.type
  );

  const boxShadowColor = selectThemeVariant(
    {
      light: theme.colors.gray5,
      dark: theme.colors.black,
    },
    theme.type
  );
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray5,
      dark: theme.colors.dark9,
    },
    theme.type
  );

  return {
    commonStyles: css`
      position: absolute;
      width: calc(100% + 20px);
      left: -10px;
      height: 250px;
      z-index: 2;
      overflow: hidden;
      background: ${theme.colors.pageBg};
      background: linear-gradient(180deg, ${gradientTop} 0%, ${gradientBottom} 104.25%);
      box-shadow: 0px 2px 4px ${boxShadowColor}, 0px 0px 2px ${boxShadowColor};
      border: 1px solid ${borderColor};
      border-radius: ${theme.border.radius.md};
    `,
    header: css`
      height: 30px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      background: ${borderColor};
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
          onClick={() => onLoadMoreContext()}
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
  const listContainerRef = useRef<HTMLDivElement>();

  useLayoutEffect(() => {
    if (shouldScrollToBottom && listContainerRef.current) {
      setScrollTop(listContainerRef.current.offsetHeight);
    }
  });

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
                renderItem={item => {
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
            {error && <Alert message={error} />}
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
  return (
    <ClickOutsideWrapper onClick={onOutsideClick}>
      <div>
        {context.after && (
          <LogRowContextGroup
            rows={context.after}
            error={errors && errors.after}
            row={row}
            className={css`
              top: -250px;
            `}
            shouldScrollToBottom
            canLoadMoreRows={hasMoreContextRows.after}
            onLoadMoreContext={onLoadMoreContext}
          />
        )}

        {context.before && (
          <LogRowContextGroup
            onLoadMoreContext={onLoadMoreContext}
            canLoadMoreRows={hasMoreContextRows.before}
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

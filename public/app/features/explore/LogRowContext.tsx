import React, { useContext, useRef, useState, useLayoutEffect } from 'react';
import {
  ThemeContext,
  List,
  GrafanaTheme,
  selectThemeVariant,
  ClickOutsideWrapper,
  CustomScrollbar,
} from '@grafana/ui';
import { css, cx } from 'emotion';
import { LogRowContextRows } from './LogRowContextProvider';

interface LogRowContextProps {
  context: LogRowContextRows;
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
      box-shadow: 0px 10px 20px ${boxShadowColor};
      border: 1px solid ${borderColor};
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
  rows: string[];
  onLoadMoreContext: () => void;
}
interface LogRowContextGroupProps {
  rows: string[];
  className: string;
  shouldScrollToBottom?: boolean;
  onLoadMoreContext: () => void;
}

const LogRowContextGroupHeader: React.FunctionComponent<LogRowContextGroupHeaderProps> = ({
  rows,
  onLoadMoreContext,
}) => {
  const theme = useContext(ThemeContext);
  const { header } = getLogRowContextStyles(theme);
  return (
    <div className={header}>
      Found {rows.length} rows.
      {(rows.length >= 10 || (rows.length > 10 && rows.length % 10 !== 0)) && (
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
  rows,
  className,
  shouldScrollToBottom,
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

  return (
    <div className={cx(className, commonStyles)}>
      {/* When displaying "after" context */}
      {shouldScrollToBottom && <LogRowContextGroupHeader rows={rows} onLoadMoreContext={onLoadMoreContext} />}
      <div className={logs}>
        <CustomScrollbar autoHide scrollTop={scrollTop}>
          <div ref={listContainerRef}>
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
          </div>
        </CustomScrollbar>
      </div>
      {/* When displaying "before" context */}
      {!shouldScrollToBottom && <LogRowContextGroupHeader rows={rows} onLoadMoreContext={onLoadMoreContext} />}
    </div>
  );
};

export const LogRowContext: React.FunctionComponent<LogRowContextProps> = ({
  context,
  onOutsideClick,
  onLoadMoreContext,
}) => {
  return (
    <ClickOutsideWrapper onClick={onOutsideClick}>
      <div>
        {context.after && context.after.length > 0 && (
          <LogRowContextGroup
            rows={context.after}
            className={css`
              top: -250px;
            `}
            shouldScrollToBottom
            onLoadMoreContext={onLoadMoreContext}
          />
        )}

        {context.before && context.before.length > 0 && (
          <LogRowContextGroup
            onLoadMoreContext={onLoadMoreContext}
            rows={context.after}
            className={css`
              top: 100%;
            `}
          />
        )}
      </div>
    </ClickOutsideWrapper>
  );
};

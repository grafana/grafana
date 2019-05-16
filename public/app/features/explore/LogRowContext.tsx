import React, { useContext } from 'react';
import { ThemeContext, List } from '@grafana/ui';
import { css, cx } from 'emotion';
import { LogRowContextRows } from './LogRowContextProvider';

interface LogRowContextProps {
  context: LogRowContextRows;
}

export const LogRowContext: React.FunctionComponent<LogRowContextProps> = ({ context }) => {
  const theme = useContext(ThemeContext);
  const commonStyles = css`
    position: absolute;
    width: calc(100% + 20px);
    left: -10px;
    height: 250px;
    z-index: 1;
    overflow-y: auto;
    padding: 10px;
    background: ${theme.colors.pageBg};
  `;

  return (
    <div>
      {context.after && context.after.length > 0 && (
        <div
          className={cx(
            css`
              top: -250px;
              box-shadow: 0 0 20px -5px ${theme.colors.black};
            `,
            commonStyles
          )}
        >
          <List
            items={context.after}
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
      )}

      {context.before && context.before.length > 0 && (
        <div
          className={cx(
            css`
              top: 100%;
              box-shadow: 0 0 20px -5px ${theme.colors.black};
            `,
            commonStyles
          )}
        >
          <List
            items={context.before}
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
      )}
    </div>
  );
};

import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Button, stylesFactory, useTheme } from '@grafana/ui';

export const Help = () => {
  const styles = getStyles(useTheme());

  return (
    <div className={styles.help}>
      <h3>Need help?</h3>
      <div className={styles.helpOptions}>
        {['Documentation', 'Tutorials', 'Community', 'Public Slack'].map((item: string, index: number) => {
          return (
            <a href="" key={`${item}-${index}`} className={styles.helpOption}>
              <Button
                variant="primary"
                size="md"
                className={css`
                  width: 150px;
                  justify-content: center;
                `}
              >
                {item}
              </Button>
            </a>
          );
        })}
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    help: css`
      width: 330px;
      padding-left: 16px;
      border-left: 3px solid ${theme.palette.blue95};
    `,
    helpOptions: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
    `,
    helpOption: css`
      margin-top: 8px;
    `,
  };
});

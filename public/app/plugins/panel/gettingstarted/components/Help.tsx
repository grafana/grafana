import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, stylesFactory, useTheme } from '@grafana/ui';

const helpOptions: Array<SelectableValue<string>> = [
  { label: 'Documentation' },
  { label: 'Tutorials' },
  { label: 'Community' },
  { label: 'Public Slack' },
];

interface Props {
  panelWidth: number;
}

export const Help: FC<Props> = ({ panelWidth }) => {
  const styles = getStyles(useTheme());

  return (
    <div className={styles.help}>
      <>
        <h3>Need help?</h3>
        <div className={styles.helpOptions}>
          {helpOptions.map((item: SelectableValue<string>, index: number) => {
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
                  {item.label}
                </Button>
              </a>
            );
          })}
        </div>
      </>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    help: css`
      width: 330px;
      padding-left: ${theme.spacing.md};
      border-left: 3px solid ${theme.palette.blue95};

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 100%;
        border-left: none;
        padding-left: 0;
      }
    `,
    helpOptions: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        flex-direction: column;
      }
    `,
    helpOption: css`
      margin-top: ${theme.spacing.sm};
    `,
  };
});

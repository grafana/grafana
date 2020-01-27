import React, { FC, ReactNode } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  children: ReactNode;
}

const getTabContentStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    tabContent: css`
      padding: ${theme.spacing.xs};
      height: 90%;
      overflow: hidden;
    `,
  };
});

export const TabContent: FC<Props> = ({ children }) => {
  const theme = useTheme();
  const styles = getTabContentStyle(theme);

  return <div className={styles.tabContent}>{children}</div>;
};

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
      padding: ${theme.spacing.sm};
      height: 95%;
    `,
  };
});

export const TabContent: FC<Props> = ({ children }) => {
  const theme = useTheme();
  const styles = getTabContentStyle(theme);

  return <div className={styles.tabContent}>{children}</div>;
};

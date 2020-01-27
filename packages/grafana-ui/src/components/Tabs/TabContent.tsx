import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const getTabContentStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    tabContent: css`
      padding: ${theme.spacing.sm};
    `,
  };
});

export const TabContent: FC<Props> = ({ children, ...restProps }) => {
  const theme = useTheme();
  const styles = getTabContentStyle(theme);

  return (
    <div {...restProps} className={styles.tabContent}>
      {children}
    </div>
  );
};

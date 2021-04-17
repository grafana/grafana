import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const getTabContentStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    tabContent: css`
      padding: ${theme.spacing.sm};
      background: ${theme.v2.palette.background.primary};
    `,
  };
});

export const TabContent: FC<Props> = ({ children, className, ...restProps }) => {
  const theme = useTheme();
  const styles = getTabContentStyle(theme);

  return (
    <div {...restProps} className={cx(styles.tabContent, className)}>
      {children}
    </div>
  );
};

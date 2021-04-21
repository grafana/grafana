import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { stylesFactory, useTheme2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const getTabContentStyle = stylesFactory((theme: GrafanaThemeV2) => {
  return {
    tabContent: css`
      padding: ${theme.spacing(1)};
      background: ${theme.colors.background.primary};
    `,
  };
});

export const TabContent: FC<Props> = ({ children, className, ...restProps }) => {
  const theme = useTheme2();
  const styles = getTabContentStyle(theme);

  return (
    <div {...restProps} className={cx(styles.tabContent, className)}>
      {children}
    </div>
  );
};

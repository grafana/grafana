import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { useStyles2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const getTabContentStyle = (theme: GrafanaTheme2) => ({
  tabContent: css`
    background: ${theme.colors.background.canvas};
  `,
});

export const TabContent: FC<Props> = ({ children, className, ...restProps }) => {
  const styles = useStyles2(getTabContentStyle);

  return (
    <div {...restProps} className={cx(styles.tabContent, className)}>
      {children}
    </div>
  );
};

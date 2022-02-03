import { css, cx } from '@emotion/css';
import React, { FC, HTMLAttributes, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

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

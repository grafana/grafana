import React, { FC, ReactNode } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
}

const getTabsBarStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = theme.colors;

  return {
    tabsWrapper: css`
      border-bottom: 1px solid ${colors.pageHeaderBorder};
    `,
    tabs: css`
      position: relative;
      top: 1px;
      display: flex;
    `,
  };
});

export const TabsBar: FC<Props> = ({ children, className }) => {
  const theme = useTheme();
  const tabsStyles = getTabsBarStyles(theme);

  return (
    <div className={cx(tabsStyles.tabsWrapper, className)}>
      <ul className={tabsStyles.tabs}>{children}</ul>
    </div>
  );
};

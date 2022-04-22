import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
  /** For hiding the bottom border (on PageHeader for example) */
  hideBorder?: boolean;
}

const getTabsBarStyles = stylesFactory((theme: GrafanaTheme2, hideBorder = false) => {
  return {
    tabsWrapper:
      !hideBorder &&
      css`
        border-bottom: 1px solid ${theme.colors.border.weak};
      `,
    tabs: css`
      position: relative;
      display: flex;
      height: 41px;
    `,
  };
});

export const TabsBar = React.forwardRef<HTMLDivElement, Props>(({ children, className, hideBorder }, ref) => {
  const theme = useTheme2();
  const tabsStyles = getTabsBarStyles(theme, hideBorder);

  return (
    <div className={cx(tabsStyles.tabsWrapper, className)} ref={ref}>
      <ul className={tabsStyles.tabs}>{children}</ul>
    </div>
  );
});

TabsBar.displayName = 'TabsBar';

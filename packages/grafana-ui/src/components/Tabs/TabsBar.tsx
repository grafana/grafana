import React, { ReactNode } from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
  /** For hiding the bottom border (on PageHeader for example) */
  hideBorder?: boolean;
}

const getTabsBarStyles = stylesFactory((theme: GrafanaTheme, hideBorder = false) => {
  const colors = theme.colors;

  return {
    tabsWrapper:
      !hideBorder &&
      css`
        border-bottom: 1px solid ${colors.pageHeaderBorder};
      `,
    tabs: css`
      position: relative;
      top: 1px;
      display: flex;
      // Sometimes TabsBar is rendered without any tabs, and should preserve height
      height: 41px;
    `,
  };
});

export const TabsBar = React.forwardRef<HTMLDivElement, Props>(({ children, className, hideBorder }, ref) => {
  const theme = useTheme();
  const tabsStyles = getTabsBarStyles(theme, hideBorder);

  return (
    <div className={cx(tabsStyles.tabsWrapper, className)} ref={ref}>
      <ul className={tabsStyles.tabs}>{children}</ul>
    </div>
  );
});

import React, { ReactNode } from 'react';
import { stylesFactory, useTheme2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
  /** For hiding the bottom border (on PageHeader for example) */
  hideBorder?: boolean;
  vertical?: boolean;
  dataTestId?: string;
}

const getTabsBarStyles = stylesFactory((theme: GrafanaTheme2, hideBorder = false, vertical = false) => {
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
      flex-direction: ${!!vertical ? 'column' : 'row'};
    `,
  };
});

export const TabsBar = React.forwardRef<HTMLDivElement, Props>(
  ({ children, className, hideBorder, vertical = false, dataTestId = '' }, ref) => {
    const theme = useTheme2();
    const tabsStyles = getTabsBarStyles(theme, hideBorder, vertical);

    return (
      <div className={cx(tabsStyles.tabsWrapper, className)} ref={ref}>
        <ul data-testid={dataTestId} className={tabsStyles.tabs}>
          {children}
        </ul>
      </div>
    );
  }
);

TabsBar.displayName = 'TabsBar';

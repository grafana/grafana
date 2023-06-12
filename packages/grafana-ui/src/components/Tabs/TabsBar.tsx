import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
  /** For hiding the bottom border (on PageHeader for example) */
  hideBorder?: boolean;
}

export const TabsBar = React.forwardRef<HTMLDivElement, Props>(({ children, className, hideBorder = false }, ref) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.tabsWrapper, hideBorder && styles.noBorder, className)} ref={ref}>
      <div className={styles.tabs} role="tablist">
        {children}
      </div>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  tabsWrapper: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    overflow-x: auto;
  `,
  noBorder: css`
    border-bottom: 0;
  `,
  tabs: css`
    position: relative;
    display: flex;
    height: ${theme.components.menuTabs.height}px;
  `,
});

TabsBar.displayName = 'TabsBar';

import { css, cx } from '@emotion/css';
import { forwardRef, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
  /** For hiding the bottom border (on PageHeader for example) */
  hideBorder?: boolean;
}

export const TabsBar = forwardRef<HTMLDivElement, Props>(({ children, className, hideBorder = false }, ref) => {
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
  tabsWrapper: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    overflowX: 'auto',
  }),
  noBorder: css({
    borderBottom: 0,
  }),
  tabs: css({
    position: 'relative',
    display: 'flex',
    height: theme.spacing(theme.components.menuTabs.height),
    alignItems: 'stretch',
  }),
});

TabsBar.displayName = 'TabsBar';

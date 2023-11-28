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
  // @PERCONA
  vertical?: boolean;
  dataTestId?: string;
}

export const TabsBar = React.forwardRef<HTMLDivElement, Props>(({
  children,
  className,
  hideBorder = false,
  // @PERCONA
  vertical = false,
  dataTestId = ''
}, ref) => {
  const styles = useStyles2(theme => getStyles(theme, vertical));

  return (
    <div className={cx(styles.tabsWrapper, hideBorder && styles.noBorder, className)} ref={ref}>
      <div data-testid={dataTestId} className={styles.tabs} role="tablist">
        {children}
      </div>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2, vertical: boolean) => ({
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
    height: `${theme.components.menuTabs.height}px`,
    alignItems: 'center',

    // @PERCONA
    [!!vertical ? 'height' : 'minHeight']: `${theme.components.menuTabs.height}px`,
    flexDirection: !!vertical ? 'column' : 'row',
    flexWrap: !!vertical ? 'nowrap' : 'wrap',
  }),
});

TabsBar.displayName = 'TabsBar';

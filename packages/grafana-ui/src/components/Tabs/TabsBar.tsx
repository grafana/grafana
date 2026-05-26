import { css, cx } from '@emotion/css';
import { forwardRef, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
  className?: string;
  /** For hiding the bottom border (on PageHeader for example) */
  hideBorder?: boolean;
  layout?: 'page' | 'contained';
}

/**
 * A composition component for rendering a TabBar with Tabs for navigation.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/navigation-tabs--docs
 */
export const TabsBar = forwardRef<HTMLDivElement, Props>(
  ({ children, className, hideBorder = false, layout = 'page', ...rest }, ref) => {
    const styles = useStyles2(getStyles);

    return (
      <div className={cx(styles.tabsWrapper, hideBorder && styles.noBorder, className)} ref={ref} {...rest}>
        <div className={cx(styles.tabs, layout === 'page' && styles.pageTabs)}>
          {children}
        </div>
      </div>
    );
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  tabsWrapper: css({
    //borderBottom: `1px solid ${theme.colors.border.subtle}`,
    boxShadow: `inset 0 -1px 0 ${theme.colors.border.subtle}`,
    overflowX: 'auto',
  }),
  noBorder: css({
    borderBottom: 0,
  }),
  tabs: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  }),
  pageTabs: css({
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),

    [theme.breakpoints.up('md')]: {
      paddingLeft: theme.spacing(4),
      paddingRight: theme.spacing(4),
    },
  }),
});

TabsBar.displayName = 'TabsBar';

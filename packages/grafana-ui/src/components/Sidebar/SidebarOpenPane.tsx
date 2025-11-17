import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

export interface SidebarOpenPaneProps {
  children?: ReactNode;
}

export function SidebarOpenPane({ children }: SidebarOpenPaneProps) {
  const styles = useStyles2(getStyles);

  return <div className={styles.openPane}>{children}</div>;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    openPane: css({
      width: '260px',
      flexGrow: 1,

      paddingBottom: theme.spacing(2),
    }),
  };
};

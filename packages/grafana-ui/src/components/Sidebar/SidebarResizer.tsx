import { css } from '@emotion/css';
import { useContext } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { SidebarContext } from './useSidebar';

export function SidebarResizer() {
  const styles = useStyles2(getStyles);
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('Sidebar.Resizer must be used within a Sidebar component');
  }

  return <div className={styles.resizer} />;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    resizer: css({
      position: 'absolute',
      width: theme.spacing(1),
      left: -theme.spacing(1),
      top: 0,
      bottom: 0,
      cursor: 'col-resize',
      zIndex: 1,
      '&:hover': {
        borderRight: `1px solid ${theme.colors.primary.border}`,
      },
    }),
  };
};

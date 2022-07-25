import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

const NAV_MENU_PORTAL_CONTAINER_ID = 'navbar-menu-portal-container';

export const getNavMenuPortalContainer = () => document.getElementById(NAV_MENU_PORTAL_CONTAINER_ID) ?? document.body;

export const NavBarMenuPortalContainer = () => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return <div className={styles.menuPortalContainer} id={NAV_MENU_PORTAL_CONTAINER_ID} />;
};

NavBarMenuPortalContainer.displayName = 'NavBarMenuPortalContainer';

const getStyles = (theme: GrafanaTheme2) => ({
  menuPortalContainer: css({
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: theme.zIndex.sidemenu,
  }),
});

import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Icon, IconButton, ToolbarButton, useStyles2 } from '@grafana/ui';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types';

import { Breadcrumbs } from '../Breadcrumbs/Breadcrumbs';
import { buildBreadcrumbs } from '../Breadcrumbs/utils';

import { NavToolbarSeparator } from './NavToolbarSeparator';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props {
  onToggleSearchBar(): void;
  onToggleMegaMenu(): void;
  onToggleKioskMode(): void;
  searchBarHidden?: boolean;
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  actions: React.ReactNode;
}

export function NavToolbar({
  actions,
  searchBarHidden,
  sectionNav,
  pageNav,
  onToggleMegaMenu,
  onToggleSearchBar,
  onToggleKioskMode,
}: Props) {
  const homeNav = useSelector((state) => state.navIndex)[HOME_NAV_ID];
  const styles = useStyles2(getStyles);
  const breadcrumbs = buildBreadcrumbs(sectionNav, pageNav, homeNav);

  return (
    <div className={styles.pageToolbar}>
      <div className={styles.menuButton}>
        <IconButton name="bars" tooltip="Toggle menu" tooltipPlacement="bottom" size="xl" onClick={onToggleMegaMenu} />
      </div>
      <Breadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbs} />
      <div className={styles.actions}>
        {actions}
        {actions && <NavToolbarSeparator />}
        {searchBarHidden && (
          <ToolbarButton onClick={onToggleKioskMode} narrow title="Enable kiosk mode" icon="monitor" />
        )}
        <ToolbarButton onClick={onToggleSearchBar} narrow title="Toggle top search bar">
          <Icon name={searchBarHidden ? 'angle-down' : 'angle-up'} size="xl" />
        </ToolbarButton>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    breadcrumbs: css({
      maxWidth: '50%',
    }),
    pageToolbar: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'flex',
      padding: theme.spacing(0, 1, 0, 2),
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    menuButton: css({
      display: 'flex',
      alignItems: 'center',
      marginRight: theme.spacing(1),
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'nowrap',
      justifyContent: 'flex-end',
      paddingLeft: theme.spacing(1),
      flexGrow: 1,
      gap: theme.spacing(0.5),
      minWidth: 0,
    }),
  };
};

import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { IconButton, ToolbarButton, useStyles2 } from '@grafana/ui';

import { Breadcrumbs } from './Breadcrumbs';
import { TopNavProps } from './TopNavUpdate';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends TopNavProps {
  onToggleSearchBar(): void;
  searchBarHidden?: boolean;
  sectionNav: NavModelItem;
  subNav?: NavModelItem;
}

export function NavToolbar({ actions, onToggleSearchBar, searchBarHidden, sectionNav, subNav }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.pageToolbar}>
      <div className={styles.menuButton}>
        <IconButton name="bars" tooltip="Toggle menu" tooltipPlacement="bottom" size="xl" onClick={() => {}} />
      </div>
      <Breadcrumbs sectionNav={sectionNav} subNav={subNav} />
      <div className={styles.leftActions}></div>
      <div className={styles.rightActions}>
        {actions}
        <ToolbarButton icon={searchBarHidden ? 'angle-down' : 'angle-up'} onClick={onToggleSearchBar} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pageToolbar: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'flex',
      padding: theme.spacing(0, 2),
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    menuButton: css({
      display: 'flex',
      alignItems: 'center',
      paddingRight: theme.spacing(1),
    }),
    leftActions: css({
      display: 'flex',
      alignItems: 'center',
      flexGrow: 1,
      gap: theme.spacing(2),
    }),
    rightActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
  };
};

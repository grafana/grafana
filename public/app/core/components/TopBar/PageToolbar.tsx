import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

import { TopBarProps } from './TopBarUpdate';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends TopBarProps {
  onToggleSearchBar(): void;
  searchBarHidden?: boolean;
  pageNavItem: NavModelItem;
}

export function PageToolbar({ title, actions, onToggleSearchBar, searchBarHidden, pageNavItem }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.pageToolbar}>
      <div>{pageNavItem.text}</div>
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
    rightActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
  };
};

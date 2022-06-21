import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { ToolbarButton, useStyles2, Icon } from '@grafana/ui';

import { TopNavProps } from './TopNavUpdate';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends TopNavProps {
  onToggleSearchBar(): void;
  searchBarHidden?: boolean;
  pageNavItem: NavModelItem;
}

export function NavToolbar({ title, actions, onToggleSearchBar, searchBarHidden, pageNavItem }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.pageToolbar}>
      <div className={styles.breadcrumbs}>
        {/** This is just temporary placeholder code. To be replaced by proper breadcrumbs component */}
        {pageNavItem.parentItem && (
          <span>
            {pageNavItem.parentItem.text} <Icon name="angle-right" />
          </span>
        )}
        {pageNavItem.text}
      </div>
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
    breadcrumbs: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
    rightActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
  };
};

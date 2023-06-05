import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { getIconForKind } from 'app/features/search/service/utils';

import { DashboardsTreeItem } from '../types';

export function TypeCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const styles = useStyles2(getStyles);
  const iconName = getIconForKind(data.item.kind);

  switch (data.item.kind) {
    case 'dashboard':
      return (
        <span className={styles.text}>
          <Icon name={iconName} /> Dashboard
        </span>
      );
    case 'folder':
      return (
        <span className={styles.text}>
          <Icon name={iconName} /> Folder
        </span>
      );
    case 'panel':
      return (
        <span className={styles.text}>
          <Icon name={iconName} /> Panel
        </span>
      );
    default:
      return null;
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    text: css({
      color: theme.colors.text.secondary,
    }),
  };
}

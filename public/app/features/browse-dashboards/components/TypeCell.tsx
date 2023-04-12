import React from 'react';
import { CellProps } from 'react-table';

import { Icon } from '@grafana/ui';
import { getIconForKind } from 'app/features/search/service/utils';

import { DashboardsTreeItem } from '../types';

export function TypeCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const iconName = getIconForKind(data.item.kind);

  switch (data.item.kind) {
    case 'dashboard':
      return (
        <>
          <Icon name={iconName} /> Dashboard
        </>
      );
    case 'folder':
      return (
        <>
          <Icon name={iconName} /> Folder
        </>
      );
    case 'panel':
      return (
        <>
          <Icon name={iconName} /> Panel
        </>
      );
    default:
      return null;
  }
}

import React from 'react';
import { CellProps } from 'react-table';

import { Icon } from '@grafana/ui';
import { TextModifier } from '@grafana/ui/src/unstable';
import { getIconForKind } from 'app/features/search/service/utils';

import { DashboardsTreeItem } from '../types';

export function TypeCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const iconName = getIconForKind(data.item.kind);

  switch (data.item.kind) {
    case 'dashboard':
      return (
        <TextModifier color="secondary">
          <Icon name={iconName} /> Dashboard
        </TextModifier>
      );
    case 'folder':
      return (
        <TextModifier color="secondary">
          <Icon name={iconName} /> Folder
        </TextModifier>
      );
    case 'panel':
      return (
        <TextModifier color="secondary">
          <Icon name={iconName} /> Panel
        </TextModifier>
      );
    default:
      return null;
  }
}

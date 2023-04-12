import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { getIconForKind } from 'app/features/search/service/utils';

import { DashboardsTreeItem } from '../types';

export function TypeCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const iconName = getIconForKind(data.item.kind);

  switch (data.item.kind) {
    case 'dashboard':
      return (
        <Text color="secondary">
          <Icon name={iconName} /> Dashboard
        </Text>
      );
    case 'folder':
      return (
        <Text color="secondary">
          <Icon name={iconName} /> Folder
        </Text>
      );
    case 'panel':
      return (
        <Text color="secondary">
          <Icon name={iconName} /> Panel
        </Text>
      );
    default:
      return null;
  }
}

// TODO: Grafana UI????
interface TextProps {
  children: React.ReactNode;
  color?: keyof GrafanaTheme2['colors']['text'];
}

function Text({ children, color }: TextProps) {
  const styles = useStyles2(useCallback((theme) => getTextStyles(theme, color), [color]));

  return <span className={styles}>{children}</span>;
}

function getTextStyles(theme: GrafanaTheme2, color: TextProps['color'] | undefined) {
  return css([
    color && {
      color: theme.colors.text[color],
    },
  ]);
}

import { type CellProps } from 'react-table';

import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';

import { type DashboardsTreeItem } from '../types';

export function StarCell({ row: { original: data } }: CellProps<DashboardsTreeItem, unknown>) {
  const item = data.item;

  if (item.kind !== 'folder') {
    return null;
  }

  // Folders share the dashboard star backing (a folder's UID is starred through the dashboard
  // star mechanism), so star them with the same group/kind as dashboards.
  return (
    <StarToolbarButton group="dashboard.grafana.app" kind="Dashboard" id={item.uid} title={item.title} hideSpinner />
  );
}

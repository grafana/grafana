import { canEditItemType } from '../permissions';
import { type BrowseDashboardsPermissions, type DashboardTreeSelection } from '../types';

export interface SelectableItem {
  kind: 'folder' | 'dashboard';
  uid: string;
}

interface ResultRows {
  length: number;
  // DataFrameView reuses one row object, so callers must read it straight away
  get: (index: number) => { kind?: string; uid?: string };
}

/** The editable folders and dashboards among the first `limit` loaded rows. */
export function getSelectableItems(
  view: ResultRows,
  permissions: BrowseDashboardsPermissions,
  limit = view.length
): SelectableItem[] {
  const items: SelectableItem[] = [];
  const end = Math.min(limit, view.length);

  for (let i = 0; i < end; i++) {
    const { kind, uid } = view.get(i);
    if ((kind === 'folder' || kind === 'dashboard') && uid && canEditItemType(kind, permissions)) {
      items.push({ kind, uid });
    }
  }

  return items;
}

export function areAllSelected(items: SelectableItem[], selectedItems: DashboardTreeSelection) {
  return items.length > 0 && items.every((item) => selectedItems[item.kind][item.uid]);
}

import { type DescendantCount } from 'app/types/folders';

import { type DashboardTreeSelection } from '../../types';

/** Returns the UIDs of folders that are currently selected in the tree selection. */
export function getSelectedFolderUIDs(selectedItems: Pick<DashboardTreeSelection, 'folder'>): string[] {
  return Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]);
}

/**
 * Returns true when the selected folders have no remaining descendants once items the user explicitly selected
 * (folders/dashboards) are subtracted from the affected-items totals.
 *
 * We do this mainly because the way the API works, i.e. returning affected items, does not currently match the UI,
 * which only needs whether folders have children items.
 */
export function getFolderIsEmpty(
  affectedItems: DescendantCount,
  selectedItems: Pick<DashboardTreeSelection, 'folder' | 'dashboard'>
): boolean {
  const selectedFolderCount = Object.values(selectedItems.folder).filter(Boolean).length;
  const selectedDashboardCount = Object.values(selectedItems.dashboard).filter(Boolean).length;

  const remaining =
    affectedItems.folders -
    selectedFolderCount +
    (affectedItems.dashboards - selectedDashboardCount) +
    affectedItems.library_elements +
    affectedItems.alertrules;

  return remaining <= 0;
}

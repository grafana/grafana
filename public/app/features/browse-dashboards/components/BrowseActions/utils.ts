import { type DescendantCount } from 'app/types/folders';

import { type DashboardTreeSelection } from '../../types';
import { getSelectedUIDs } from '../../utils/dashboards';

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
  const selectedFolderCount = getSelectedUIDs(selectedItems, 'folder').length;
  const selectedDashboardCount = getSelectedUIDs(selectedItems, 'dashboard').length;

  const remaining =
    affectedItems.folders -
    selectedFolderCount +
    (affectedItems.dashboards - selectedDashboardCount) +
    affectedItems.librarypanels +
    affectedItems.alertrules +
    affectedItems.recordingrules +
    affectedItems.variables;

  return remaining <= 0;
}

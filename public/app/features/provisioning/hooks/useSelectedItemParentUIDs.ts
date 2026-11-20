import { createSelector } from 'reselect';

import { childrenByParentUIDSelector, rootItemsSelector } from 'app/features/browse-dashboards/state/hooks';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { type DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { getSelectedItemRefs } from 'app/features/browse-dashboards/utils/dashboards';
import { type StoreState, useSelector } from 'app/types/store';

type SelectedItems = Omit<DashboardTreeSelection, 'panel' | '$all'>;

// Memoized per selection so the tree walk doesn't rerun on every render.
const selectedItemParentUIDsSelector = createSelector(
  rootItemsSelector,
  childrenByParentUIDSelector,
  (state: StoreState, selectedItems: SelectedItems) => selectedItems,
  (rootCollection, childrenByParentUID, selectedItems) => {
    const rootItems = rootCollection?.items ?? [];
    return getSelectedItemRefs(selectedItems).map(({ kind, uid }) => {
      const item = findItem(rootItems, childrenByParentUID, kind, uid);
      return item ? (item.parentUID ?? '') : undefined;
    });
  }
);

/**
 * Parent folder UID of each selected item. '' is the instance root; undefined means the item
 * isn't in the loaded browse tree.
 */
export function useSelectedItemParentUIDs(selectedItems: SelectedItems): Array<string | undefined> {
  return useSelector((state) => selectedItemParentUIDsSelector(state, selectedItems));
}

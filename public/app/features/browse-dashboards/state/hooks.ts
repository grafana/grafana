import { createSelector } from 'reselect';

import { DashboardViewItem } from 'app/features/search/types';
import { useSelector, StoreState } from 'app/types';

import { DashboardsTreeItem } from '../types';

const flatTreeSelector = createSelector(
  (wholeState: StoreState) => wholeState.browseDashboards.rootItems,
  (wholeState: StoreState) => wholeState.browseDashboards.childrenByParentUID,
  (wholeState: StoreState) => wholeState.browseDashboards.openFolders,
  (wholeState: StoreState, rootFolderUID: string | undefined) => rootFolderUID,
  (rootItems, childrenByParentUID, openFolders, folderUID) => {
    return createFlatTree(folderUID, rootItems, childrenByParentUID, openFolders);
  }
);

const hasSelectionSelector = createSelector(
  (wholeState: StoreState) => wholeState.browseDashboards.selectedItems,
  (selectedItems) => {
    return Object.values(selectedItems).some((selectedItem) =>
      Object.values(selectedItem).some((isSelected) => isSelected)
    );
  }
);

export function useFlatTreeState(folderUID: string | undefined) {
  return useSelector((state) => flatTreeSelector(state, folderUID));
}

export function useHasSelection() {
  return useSelector((state) => hasSelectionSelector(state));
}

export function useSelectedItemsState() {
  return useSelector((wholeState: StoreState) => wholeState.browseDashboards.selectedItems);
}

/**
 * Creates a list of items, with level indicating it's 'nested' in the tree structure
 *
 * @param folderUID The UID of the folder being viewed, or undefined if at root Browse Dashboards page
 * @param rootItems Array of loaded items at the root level (without a parent). If viewing a folder, we expect this to be empty and unused
 * @param childrenByUID Arrays of children keyed by their parent UID
 * @param openFolders Object of UID to whether that item is expanded or not
 * @param level level of item in the tree. Only to be specified when called recursively.
 */
function createFlatTree(
  folderUID: string | undefined,
  rootItems: DashboardViewItem[],
  childrenByUID: Record<string, DashboardViewItem[] | undefined>,
  openFolders: Record<string, boolean>,
  level = 0
): DashboardsTreeItem[] {
  function mapItem(item: DashboardViewItem, parentUID: string | undefined, level: number): DashboardsTreeItem[] {
    const mappedChildren = createFlatTree(item.uid, rootItems, childrenByUID, openFolders, level + 1);

    const isOpen = Boolean(openFolders[item.uid]);
    const emptyFolder = childrenByUID[item.uid]?.length === 0;
    if (isOpen && emptyFolder) {
      mappedChildren.push({
        isOpen: false,
        level: level + 1,
        item: { kind: 'ui-empty-folder', uid: item.uid + '-empty-folder' },
      });
    }

    const thisItem = {
      item,
      parentUID,
      level,
      isOpen,
    };

    return [thisItem, ...mappedChildren];
  }

  const isOpen = (folderUID && openFolders[folderUID]) || level === 0;

  const items = folderUID
    ? (isOpen && childrenByUID[folderUID]) || [] // keep seperate lines
    : rootItems;

  return items.flatMap((item) => mapItem(item, folderUID, level));
}

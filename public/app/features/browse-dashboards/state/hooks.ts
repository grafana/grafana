import { useCallback, useRef } from 'react';
import { createSelector } from 'reselect';

import { DashboardViewItem } from 'app/features/search/types';
import { useSelector, StoreState, useDispatch } from 'app/types';

import { PAGE_SIZE } from '../api/services';
import { isSharedWithMe } from '../components/utils';
import {
  BrowseDashboardsState,
  DashboardsTreeItem,
  DashboardTreeSelection,
  DashboardViewItemWithUIItems,
  UIDashboardViewItem,
} from '../types';

import { fetchNextChildrenPage } from './actions';
import { getChildrenStateKey, getPaginationPlaceholders } from './utils';

export const childrenCollectionsSelection = (wholeState: StoreState) => wholeState.browseDashboards.children;
export const openFoldersSelector = (wholeState: StoreState) => wholeState.browseDashboards.openFolders;
export const selectedItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.selectedItems;

const flatTreeSelector = createSelector(
  childrenCollectionsSelection,
  openFoldersSelector,
  (wholeState: StoreState, rootFolderUID: string | undefined) => rootFolderUID,
  (childrenCollections, openFolders, folderUID) => {
    return createFlatTree(folderUID, childrenCollections, openFolders);
  }
);

const hasSelectionSelector = createSelector(selectedItemsSelector, (selectedItems) => {
  return Object.values(selectedItems).some((selectedItem) =>
    Object.values(selectedItem).some((isSelected) => isSelected)
  );
});

// Returns a DashboardTreeSelection but unselects any selected folder's children.
// This is useful when making backend requests to move or delete items.
// In this case, we only need to move/delete the parent folder and it will cascade to the children.
const selectedItemsForActionsSelector = createSelector(
  selectedItemsSelector,
  childrenCollectionsSelection,
  (selectedItems, childrenCollections) => {
    // Take a copy of the selected items to work with
    // We don't care about panels here, only dashboards and folders can be moved or deleted
    const result: Omit<DashboardTreeSelection, 'panel' | '$all'> = {
      dashboard: { ...selectedItems.dashboard },
      folder: { ...selectedItems.folder },
    };

    // Loop over selected folders in the input
    for (const folderUID of Object.keys(selectedItems.folder)) {
      const isSelected = selectedItems.folder[folderUID];
      if (isSelected) {
        // Unselect any children in the output
        const collection = childrenCollections[folderUID]; // JOSH TODO: this is wrong
        if (collection) {
          for (const child of collection.items) {
            if (child.kind === 'dashboard') {
              result.dashboard[child.uid] = false;
            }
            if (child.kind === 'folder') {
              result.folder[child.uid] = false;
            }
          }
        }
      }
    }

    return result;
  }
);

// TODO: excludeKinds should be a DashboardUIKind or string array?
export function useBrowseLoadingStatus(
  folderUID: string | undefined,
  excludeKinds?: string[]
): 'pending' | 'fulfilled' {
  return useSelector((wholeState) => {
    const stateKey = getChildrenStateKey({ parentUID: folderUID, excludeKinds });

    const children = wholeState.browseDashboards.children[stateKey];
    return children ? 'fulfilled' : 'pending';
  });
}

export function useFlatTreeState(folderUID: string | undefined) {
  return useSelector((state) => flatTreeSelector(state, folderUID));
}

export function useHasSelection() {
  return useSelector((state) => hasSelectionSelector(state));
}

export function useCheckboxSelectionState() {
  return useSelector(selectedItemsSelector);
}

export function useChildrenCollectionsState() {
  return useSelector((wholeState: StoreState) => wholeState.browseDashboards.children);
}

export function useActionSelectionState() {
  return useSelector((state) => selectedItemsForActionsSelector(state));
}

export function useLoadNextChildrenPage(
  excludeKinds: Array<DashboardViewItemWithUIItems['kind'] | UIDashboardViewItem['uiKind']> = []
) {
  const dispatch = useDispatch();
  const requestInFlightRef = useRef(false);

  const handleLoadMore = useCallback(
    (folderUID: string | undefined) => {
      if (requestInFlightRef.current) {
        return Promise.resolve();
      }

      requestInFlightRef.current = true;

      const promise = dispatch(fetchNextChildrenPage({ parentUID: folderUID, excludeKinds, pageSize: PAGE_SIZE }));
      promise.finally(() => (requestInFlightRef.current = false));

      return promise;
    },
    [dispatch, excludeKinds]
  );

  return handleLoadMore;
}

/**
 * Creates a list of items, with level indicating it's nesting in the tree structure
 *
 * @param folderUID The UID of the folder being viewed, or undefined if at root Browse Dashboards page
 * @param rootItems Array of loaded items at the root level (without a parent). If viewing a folder, we expect this to be empty and unused
 * @param childrenByUID Arrays of children keyed by their parent UID
 * @param openFolders Object of UID to whether that item is expanded or not
 * @param level level of item in the tree. Only to be specified when called recursively.
 */
export function createFlatTree(
  folderUID: string | undefined,
  childrenCollections: BrowseDashboardsState['children'],
  openFolders: Record<string, boolean>,
  level = 0,
  excludeKinds: Array<DashboardViewItemWithUIItems['kind'] | UIDashboardViewItem['uiKind']> = [],
  excludeUIDs: string[] = []
): DashboardsTreeItem[] {
  function mapItem(item: DashboardViewItem, parentUID: string | undefined, level: number): DashboardsTreeItem[] {
    if (excludeKinds.includes(item.kind) || excludeUIDs.includes(item.uid)) {
      return [];
    }

    const mappedChildren = createFlatTree(
      item.uid,
      childrenCollections,
      openFolders,
      level + 1,
      excludeKinds,
      excludeUIDs
    );

    const childrenStateKey = getChildrenStateKey({ parentUID: item.uid, excludeKinds });

    const isOpen = Boolean(openFolders[item.uid]);
    const emptyFolder = childrenCollections[childrenStateKey]?.items.length === 0;

    if (isOpen && emptyFolder && !excludeKinds.includes('empty-folder')) {
      mappedChildren.push({
        isOpen: false,
        level: level + 1,
        item: { kind: 'ui', uiKind: 'empty-folder', uid: item.uid + 'empty-folder' },
        parentUID,
      });
    }

    const thisItem = {
      item,
      parentUID,
      level,
      isOpen,
    };

    const items = [thisItem, ...mappedChildren];

    if (isSharedWithMe(thisItem.item.uid)) {
      items.push({
        item: {
          kind: 'ui',
          uiKind: 'divider',
          uid: 'shared-with-me-divider',
        },
        parentUID,
        level: level + 1,
        isOpen: false,
      });
    }

    return items;
  }

  const stateKey = getChildrenStateKey({ parentUID: folderUID, excludeKinds });
  const collection = childrenCollections[stateKey];
  const isOpen = (folderUID && openFolders[folderUID]) || level === 0;

  const items = folderUID
    ? isOpen && collection?.items // keep seperate lines
    : collection?.items;

  let children = (items || []).flatMap((item) => {
    return mapItem(item, folderUID, level);
  });

  // this is very custom to the folder picker right now
  // we exclude dashboards, but if you have more than 1 page of dashboards collection.isFullyLoaded is false
  // so we need to check that we're ignoring dashboards and we've fetched all the folders
  // TODO generalize this properly (e.g. split state by kind?)
  const isConsideredLoaded = excludeKinds.includes('dashboard') && collection?.lastFetchedKind === 'dashboard';

  const showPlaceholders =
    (level === 0 && !collection) || (isOpen && collection && !(collection.isFullyLoaded || isConsideredLoaded));

  if (showPlaceholders) {
    children = children.concat(getPaginationPlaceholders(PAGE_SIZE, folderUID, level));
  }

  return children;
}

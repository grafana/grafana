import { useCallback, useMemo, useRef } from 'react';
import { useStore } from 'react-redux';
import { createSelector } from 'reselect';

import { STARRED_FOLDERS_UID } from 'app/features/search/constants';
import { type DashboardViewItem } from 'app/features/search/types';
import { useStarredSearch } from 'app/features/stars/hooks';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import {
  type BrowseDashboardsState,
  type DashboardsTreeItem,
  type DashboardTreeSelection,
  type DashboardViewItemCollection,
  type DashboardViewItemWithUIItems,
  type UIDashboardViewItem,
} from '../types';
import { addStarredFolderPrefix, getFolderURL, isVirtualStarredFolder } from '../utils/dashboards';

import { fetchNextChildrenPage } from './actions';
import { collectionGeneration, collectionKeyOf, getPaginationPlaceholders } from './utils';

export const rootItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.rootItems;
export const childrenByParentUIDSelector = (wholeState: StoreState) => wholeState.browseDashboards.childrenByParentUID;
const openFoldersSelector = (wholeState: StoreState) => wholeState.browseDashboards.openFolders;
const selectedItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.selectedItems;

const flatTreeSelector = createSelector(
  rootItemsSelector,
  childrenByParentUIDSelector,
  openFoldersSelector,
  (wholeState: StoreState, rootFolderUID: string | undefined) => rootFolderUID,
  (
    wholeState: StoreState,
    rootFolderUID: string | undefined,
    starredFolders: DashboardViewItemCollection | undefined
  ) => starredFolders,
  (rootItems, childrenByParentUID, openFolders, folderUID, starredFolders) => {
    // The slice never holds the Starred folders children; they join the lookup here, so the tree reads them like
    // any other collection
    const childrenByUID = starredFolders
      ? { ...childrenByParentUID, [STARRED_FOLDERS_UID]: starredFolders }
      : childrenByParentUID;
    return createFlatTree(folderUID, rootItems, childrenByUID, openFolders);
  }
);

/**
 * The virtual "Starred folders" root's children, derived from the starred search every starred view reads. Nothing
 * is fetched or stored for them: a star toggle, rename or delete changes the shared rows and the tree follows. Open
 * state and selection stay in the slice under the prefixed uid, as for any folder. Undefined until the first rows
 * land, which the tree shows like any folder whose first page is in flight.
 */
function useStarredFoldersCollection(): DashboardViewItemCollection | undefined {
  const { rows, error } = useStarredSearch();
  return useMemo(() => {
    // A star set that can't be read (an anonymous user's 403s) has no rows coming, so the root shows empty rather
    // than loading forever
    if (!rows && !error) {
      return undefined;
    }
    const items = (rows ?? [])
      .filter((row) => row.kind === 'folder')
      .map<DashboardViewItem>((row) => ({
        kind: 'folder',
        // Prefixed uid for independent tree state; the real uid drives the folder URL
        uid: addStarredFolderPrefix(row.uid),
        title: row.name,
        parentUID: STARRED_FOLDERS_UID,
        url: getFolderURL(row.uid),
      }));
    return {
      items,
      lastFetchedKind: 'dashboard',
      lastFetchedPage: 1,
      lastKindHasMoreItems: false,
      isFullyLoaded: true,
    };
  }, [rows, error]);
}

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
  childrenByParentUIDSelector,
  (selectedItems, childrenByParentUID) => {
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
        const collection = childrenByParentUID[folderUID];
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

export function useBrowseLoadingStatus(folderUID: string | undefined): 'pending' | 'fulfilled' {
  return useSelector((wholeState) => {
    const children = folderUID
      ? wholeState.browseDashboards.childrenByParentUID[folderUID]
      : wholeState.browseDashboards.rootItems;

    return children ? 'fulfilled' : 'pending';
  });
}

export function useFlatTreeState(folderUID: string | undefined) {
  const starredFolders = useStarredFoldersCollection();
  return useSelector((state) => flatTreeSelector(state, folderUID, starredFolders));
}

export function useHasSelection() {
  return useSelector((state) => hasSelectionSelector(state));
}

export function useCheckboxSelectionState() {
  return useSelector(selectedItemsSelector);
}

export function useChildrenByParentUIDState() {
  return useSelector((wholeState: StoreState) => wholeState.browseDashboards.childrenByParentUID);
}

export function useActionSelectionState() {
  return useSelector((state) => selectedItemsForActionsSelector(state));
}

export function useLoadNextChildrenPage(
  excludeKinds: Array<DashboardViewItemWithUIItems['kind'] | UIDashboardViewItem['uiKind']> = []
) {
  const dispatch = useDispatch();
  const store = useStore<StoreState>();
  const requestInFlightRef = useRef(false);

  const handleLoadMore = useCallback(
    function load(folderUID: string | undefined): Promise<unknown> {
      if (requestInFlightRef.current) {
        return Promise.resolve();
      }

      requestInFlightRef.current = true;

      const promise = dispatch(fetchNextChildrenPage({ parentUID: folderUID, excludeKinds, pageSize: PAGE_SIZE }));
      promise.then((action) => {
        requestInFlightRef.current = false;
        // The reducer drops a page whose collection was replaced or dropped while it was in flight.
        // The tree asked for those rows once and will not ask again, so load against the new listing.
        const key = collectionKeyOf(folderUID);
        const { browseDashboards } = store.getState();
        const current = key ? browseDashboards.childrenByParentUID[key] : browseDashboards.rootItems;
        const dropped =
          fetchNextChildrenPage.fulfilled.match(action) &&
          action.payload !== undefined &&
          action.payload.generation !== collectionGeneration(browseDashboards, key);
        if (dropped && !current?.isFullyLoaded) {
          load(folderUID);
        }
      });

      return promise;
    },
    [dispatch, store, excludeKinds]
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
function createFlatTree(
  folderUID: string | undefined,
  rootCollection: BrowseDashboardsState['rootItems'],
  childrenByUID: BrowseDashboardsState['childrenByParentUID'],
  openFolders: Record<string, boolean>,
  level = 0
): DashboardsTreeItem[] {
  function mapItem(item: DashboardViewItem, parentUID: string | undefined, level: number): DashboardsTreeItem[] {
    // Only folders have children
    if (item.kind !== 'folder') {
      return [{ item, parentUID, level, isOpen: false }];
    }

    const mappedChildren = createFlatTree(item.uid, rootCollection, childrenByUID, openFolders, level + 1);

    const isOpen = Boolean(openFolders[item.uid]);
    const collection = childrenByUID[item.uid];
    if (isOpen && collection?.items.length === 0) {
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
      // Decided here, where the lookup includes the derived collections, so a row can't think itself loading
      // once its children are on screen
      isLoading: isOpen && !collection,
    };

    const items = [thisItem, ...mappedChildren];

    // Starred folders is always the last virtual root, so the divider follows it
    const isLastVirtualFolder = isVirtualStarredFolder(thisItem.item.uid);

    if (isLastVirtualFolder) {
      items.push({
        item: {
          kind: 'ui',
          uiKind: 'divider',
          uid: `${thisItem.item.uid}-divider`,
        },
        parentUID,
        level: level + 1,
        isOpen: false,
      });
    }

    return items;
  }

  const isOpen = (folderUID && openFolders[folderUID]) || level === 0;

  const collection = folderUID ? childrenByUID[folderUID] : rootCollection;

  const items = folderUID
    ? isOpen && collection?.items // keep seperate lines
    : collection?.items;

  let children = (items || []).flatMap((item) => {
    return mapItem(item, folderUID, level);
  });

  const showPlaceholders = (level === 0 && !collection) || (isOpen && collection && !collection.isFullyLoaded);

  if (showPlaceholders) {
    children = children.concat(getPaginationPlaceholders(PAGE_SIZE, folderUID, level));
  }

  return children;
}

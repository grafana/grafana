import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useRef } from 'react';
import { createSelector } from 'reselect';

import { useGetEditableFolderNamesQuery } from 'app/api/clients/dashboard/v0alpha1';
import { type DashboardViewItem } from 'app/features/search/types';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import {
  type BrowseDashboardsState,
  type DashboardsTreeItem,
  type DashboardTreeSelection,
  type DashboardViewItemWithUIItems,
  type UIDashboardViewItem,
} from '../types';
import {
  isSharedWithMe,
  isVirtualStarredFolder,
  isVirtualTeamFolder,
  starredFoldersEnabled,
  stripVirtualFolderPrefix,
} from '../utils/dashboards';

import { fetchNextChildrenPage } from './actions';
import { getPaginationPlaceholders } from './utils';

export const rootItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.rootItems;
export const childrenByParentUIDSelector = (wholeState: StoreState) => wholeState.browseDashboards.childrenByParentUID;
const openFoldersSelector = (wholeState: StoreState) => wholeState.browseDashboards.openFolders;
const selectedItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.selectedItems;

const flatTreeSelector = createSelector(
  rootItemsSelector,
  childrenByParentUIDSelector,
  openFoldersSelector,
  (wholeState: StoreState, rootFolderUID: string | undefined) => rootFolderUID,
  (rootItems, childrenByParentUID, openFolders, folderUID) => {
    return createFlatTree(folderUID, rootItems, childrenByParentUID, openFolders);
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
  return useSelector((state) => flatTreeSelector(state, folderUID));
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

const folderPagesByItems = new WeakMap<DashboardViewItem[], Map<string, string[]>>();

// Splits a collection's folders into pages, and returns the page holding the given folder as search API names.
// Every folder in a page gets the same array, so sibling rows share one query. Memoised per items array, which
// redux replaces whenever the collection changes.
function getFolderPageNames(items: DashboardViewItem[], folderUID: string): string[] | undefined {
  let pages = folderPagesByItems.get(items);
  if (!pages) {
    pages = new Map();
    const folders = items.filter(
      (item) =>
        item.kind === 'folder' &&
        !isSharedWithMe(item.uid) &&
        !isVirtualTeamFolder(item.uid) &&
        !isVirtualStarredFolder(item.uid)
    );
    for (let i = 0; i < folders.length; i += PAGE_SIZE) {
      const page = folders.slice(i, i + PAGE_SIZE);
      // Tree UIDs under a virtual root carry its prefix, but the search API only knows the real folder UID
      const names = page.map((folder) => stripVirtualFolderPrefix(folder.uid));
      for (const folder of page) {
        pages.set(folder.uid, names);
      }
    }
    folderPagesByItems.set(items, pages);
  }
  return pages.get(folderUID);
}

/**
 * Whether the user is unable to edit this folder. False for anything that isn't a folder, and while the
 * folder's access is still loading.
 */
export function useIsReadOnlyFolder({ item, parentUID }: DashboardsTreeItem): boolean {
  const isFolderEditAccessEnabled = useBooleanFlagValue('grafana.browseDashboardsFolderEditAccess', false);
  // Edit access comes from the search API, which only backs the browse list with the app platform folder API
  const isFoldersAppPlatformAPIEnabled = useBooleanFlagValue('foldersAppPlatformAPI', true);
  const siblings = useSelector(
    (wholeState) =>
      (parentUID ? wholeState.browseDashboards.childrenByParentUID[parentUID] : wholeState.browseDashboards.rootItems)
        ?.items
  );

  const names =
    isFolderEditAccessEnabled && isFoldersAppPlatformAPIEnabled && siblings && item.kind === 'folder'
      ? getFolderPageNames(siblings, item.uid)
      : undefined;
  const { currentData: editableNames } = useGetEditableFolderNamesQuery(names ? { names } : skipToken);

  return editableNames !== undefined && !editableNames.includes(stripVirtualFolderPrefix(item.uid));
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
    const emptyFolder = childrenByUID[item.uid]?.items.length === 0;
    if (isOpen && emptyFolder) {
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

    // Add a divider after the last virtual folder (shared with me / team folders / starred folders)
    const starredOn = starredFoldersEnabled();
    const isLastVirtualFolder =
      isVirtualStarredFolder(thisItem.item.uid) || (isVirtualTeamFolder(thisItem.item.uid) && !starredOn);

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

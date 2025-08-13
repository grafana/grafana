import { PayloadAction } from '@reduxjs/toolkit';

import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

import { GENERAL_FOLDER_UID } from '../../search/constants';
import { isSharedWithMe } from '../components/utils';
import { BrowseDashboardsState } from '../types';

import { fetchNextChildrenPage, refetchChildren } from './actions';
import { findItem } from './utils';

type FetchNextChildrenPageFulfilledAction = ReturnType<typeof fetchNextChildrenPage.fulfilled>;
type RefetchChildrenFulfilledAction = ReturnType<typeof refetchChildren.fulfilled>;

export function refetchChildrenFulfilled(state: BrowseDashboardsState, action: RefetchChildrenFulfilledAction) {
  const { children, page, kind, lastPageOfKind } = action.payload;
  const { parentUID } = action.meta.arg;

  const newCollection = {
    items: children,
    lastFetchedKind: kind,
    lastFetchedPage: page,
    lastKindHasMoreItems: !lastPageOfKind,
    isFullyLoaded: kind === 'dashboard' && lastPageOfKind,
  };

  if (parentUID && parentUID !== GENERAL_FOLDER_UID) {
    state.childrenByParentUID[parentUID] = newCollection;
  } else {
    state.rootItems = newCollection;
  }
}

export function fetchNextChildrenPageFulfilled(
  state: BrowseDashboardsState,
  action: FetchNextChildrenPageFulfilledAction
) {
  const payload = action.payload;
  if (!payload) {
    // If not additional pages to load, the action returns undefined
    return;
  }

  const { children, page, kind, lastPageOfKind } = payload;
  const { parentUID, excludeKinds = [] } = action.meta.arg;

  const collection = parentUID ? state.childrenByParentUID[parentUID] : state.rootItems;
  const prevItems = collection?.items ?? [];

  const newCollection = {
    items: prevItems.concat(children),
    lastFetchedKind: kind,
    lastFetchedPage: page,
    lastKindHasMoreItems: !lastPageOfKind,
    isFullyLoaded: !excludeKinds.includes('dashboard') ? kind === 'dashboard' && lastPageOfKind : lastPageOfKind,
  };

  if (!parentUID) {
    state.rootItems = newCollection;
    return;
  }

  state.childrenByParentUID[parentUID] = newCollection;

  // If the parent of the items we've loaded are selected, we must select all these items also
  const parentIsSelected = state.selectedItems.folder[parentUID];
  if (parentIsSelected) {
    for (const child of children) {
      state.selectedItems[child.kind][child.uid] = true;
    }
  }
}

export function setFolderOpenState(
  state: BrowseDashboardsState,
  action: PayloadAction<{ folderUID: string; isOpen: boolean }>
) {
  const { folderUID, isOpen } = action.payload;
  state.openFolders[folderUID] = isOpen;
}

export function setItemSelectionState(
  state: BrowseDashboardsState,

  // SearchView doesn't use DashboardViewItemKind (yet), so we pick just the specific properties
  // we're interested in
  action: PayloadAction<{
    item: Pick<DashboardViewItem, 'kind' | 'uid' | 'parentUID' | 'managedBy'>;
    isSelected: boolean;
  }>
) {
  const { item, isSelected } = action.payload;

  // UI shouldn't allow it, but also prevent sharedwithme from being selected
  if (isSharedWithMe(item.uid)) {
    return;
  }

  // Prevent selection of root provisioned folders
  if (item.managedBy === ManagerKind.Repo && !item.parentUID) {
    return;
  }

  // Selecting a folder selects all children, and unselecting a folder deselects all children
  // so propagate the new selection state to all descendants
  function markChildren(kind: DashboardViewItemKind, uid: string) {
    state.selectedItems[kind][uid] = isSelected;

    if (kind !== 'folder') {
      return;
    }

    let collection = state.childrenByParentUID[uid];
    for (const child of collection?.items ?? []) {
      markChildren(child.kind, child.uid);
    }
  }

  markChildren(item.kind, item.uid);

  // If we're unselecting a child, we also need to unselect all ancestors.
  if (!isSelected) {
    let nextParentUID = item.parentUID;

    while (nextParentUID) {
      const parent = findItem(state.rootItems?.items ?? [], state.childrenByParentUID, nextParentUID);

      // This case should not happen, but a find can theortically return undefined, and it
      // helps limit infinite loops
      if (!parent) {
        break;
      }

      // A folder cannot be selected if any of it's children are unselected
      state.selectedItems[parent.kind][parent.uid] = false;

      nextParentUID = parent.parentUID;
    }
  }

  // Check to see if we should mark the header checkbox selected if all root items are selected
  state.selectedItems.$all = state.rootItems?.items?.every((v) => state.selectedItems[v.kind][v.uid]) ?? false;
}

export function setAllSelection(
  state: BrowseDashboardsState,
  action: PayloadAction<{ isSelected: boolean; folderUID: string | undefined; excludeUIDs?: string[] }>
) {
  const { isSelected, folderUID: folderUIDArg, excludeUIDs } = action.payload;

  // If we're in the folder view for sharedwith me (currently not supported)
  // bail and don't select anything
  if (folderUIDArg && isSharedWithMe(folderUIDArg)) {
    return;
  }

  state.selectedItems.$all = isSelected;

  // Search works a bit differently so the state here does different things...
  // In search:
  //  - When "Selecting all", it sends individual state updates with setItemSelectionState.
  //  - When "Deselecting all", it uses this setAllSelection. Search results aren't stored in
  //    redux, so we just need to iterate over the selected items to flip them to false

  if (isSelected) {
    // Recursively select the children of the folder in view
    function selectChildrenOfFolder(folderUID: string | undefined) {
      // Don't descend into the sharedwithme folder
      if (folderUID && isSharedWithMe(folderUID)) {
        return;
      }

      const collection = folderUID ? state.childrenByParentUID[folderUID] : state.rootItems;

      // Bail early if the collection isn't found (not loaded yet)
      if (!collection) {
        return;
      }

      for (const child of collection.items) {
        // Don't traverse into the sharedwithme folder
        if (isSharedWithMe(child.uid)) {
          continue;
        }

        // Skip items in the exclude list
        if (excludeUIDs?.includes(child.uid)) {
          continue;
        }

        state.selectedItems[child.kind][child.uid] = isSelected;

        if (child.kind !== 'folder') {
          continue;
        }

        selectChildrenOfFolder(child.uid);
      }
    }

    selectChildrenOfFolder(folderUIDArg);
  } else {
    // if deselecting only need to loop over what we've already selected
    for (const kind in state.selectedItems) {
      if (!(kind === 'dashboard' || kind === 'panel' || kind === 'folder')) {
        continue;
      }

      const selection = state.selectedItems[kind];

      for (const uid in selection) {
        selection[uid] = isSelected;
      }
    }
  }
}

export function clearFolders(state: BrowseDashboardsState, action: PayloadAction<Array<string | undefined>>) {
  const folderUIDs = Array.isArray(action.payload) ? action.payload : [action.payload];

  for (const folderUID of folderUIDs) {
    if (!folderUID) {
      state.rootItems = undefined;
    } else {
      state.childrenByParentUID[folderUID] = undefined;

      // close the folder to require it to be refetched next time its opened
      state.openFolders[folderUID] = false;
    }
  }
}

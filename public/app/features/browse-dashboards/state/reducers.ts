import { type PayloadAction } from '@reduxjs/toolkit';

import { type DashboardViewItem, type DashboardViewItemKind } from 'app/features/search/types';

import { isRootFolderUID } from '../../search/constants';
import { type BrowseDashboardsState } from '../types';
import { isNonSelectableVirtualFolder } from '../utils/dashboards';

import { type fetchNextChildrenPage, type refetchChildren } from './actions';
import { ancestorsOf } from './utils';

type FetchNextChildrenPageFulfilledAction = ReturnType<typeof fetchNextChildrenPage.fulfilled>;
type RefetchChildrenFulfilledAction = ReturnType<typeof refetchChildren.fulfilled>;

export function refetchChildrenFulfilled(state: BrowseDashboardsState, action: RefetchChildrenFulfilledAction) {
  const { children, page, kind, lastPageOfKind } = action.payload;
  const { parentUID } = action.meta.arg;

  const isRoot = !parentUID || isRootFolderUID(parentUID);
  const previousItems = (isRoot ? state.rootItems : state.childrenByParentUID[parentUID])?.items ?? [];

  // A folder/dashboard undergoing an async cascade delete drops out of search results the instant
  // deletionTimestamp is set, well before the cascade actually finishes -- long before this refetch
  // (triggered by the delete action itself) would otherwise remove its row. Keep it visible, using
  // its last-known data, for as long as it's tracked in cascadeDeletingUIDs, so
  // DeletingFolderBadge/DeletingDashboardBadge still has a row to render on and can poll the item's
  // real state directly instead of relying on search. Those components remove the UID from
  // cascadeDeletingUIDs (via itemCascadeDeleteFinished) once they've confirmed it's actually gone,
  // at which point the next refetch drops it for real.
  const newUIDs = new Set(children.map((item) => item.uid));
  const ghostItems = previousItems.filter((item) => state.cascadeDeletingUIDs[item.uid] && !newUIDs.has(item.uid));

  const newCollection = {
    items: ghostItems.length > 0 ? [...children, ...ghostItems] : children,
    lastFetchedKind: kind,
    lastFetchedPage: page,
    lastKindHasMoreItems: !lastPageOfKind,
    isFullyLoaded: kind === 'dashboard' && lastPageOfKind,
  };

  if (parentUID && !isRootFolderUID(parentUID)) {
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

  // UI shouldn't allow it, but also prevent sharedwithme/teamfolders from being selected
  if (isNonSelectableVirtualFolder(item.uid)) {
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

  // A folder cannot stay selected once one of its descendants is unselected
  if (!isSelected) {
    for (const parent of ancestorsOf(item, state.rootItems?.items ?? [], state.childrenByParentUID)) {
      state.selectedItems.folder[parent.uid] = false;
    }
  }

  // Check to see if we should mark the header checkbox selected if all root items are selected
  state.selectedItems.$all = state.rootItems?.items?.every((v) => state.selectedItems[v.kind][v.uid]) ?? false;
}

export function setAllSelection(
  state: BrowseDashboardsState,
  action: PayloadAction<{ isSelected: boolean; folderUID: string | undefined; excludeFolderUIDs?: string[] }>
) {
  const { isSelected, folderUID: folderUIDArg, excludeFolderUIDs } = action.payload;

  // If we're in the folder view for sharedwithme or teamfolders (currently not supported)
  // bail and don't select anything
  if (folderUIDArg && isNonSelectableVirtualFolder(folderUIDArg)) {
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
      // Don't descend into the sharedwithme or teamfolders folder
      if (folderUID && isNonSelectableVirtualFolder(folderUID)) {
        return;
      }

      const collection = folderUID ? state.childrenByParentUID[folderUID] : state.rootItems;

      // Bail early if the collection isn't found (not loaded yet)
      if (!collection) {
        return;
      }

      for (const child of collection.items) {
        // Don't traverse into the sharedwithme or teamfolders folder
        if (isNonSelectableVirtualFolder(child.uid)) {
          continue;
        }

        if (child.kind === 'folder' && excludeFolderUIDs?.includes(child.uid)) {
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

export function itemCascadeDeleteStarted(state: BrowseDashboardsState, action: PayloadAction<string>) {
  state.cascadeDeletingUIDs[action.payload] = true;
}

export function itemCascadeDeleteFinished(state: BrowseDashboardsState, action: PayloadAction<string>) {
  delete state.cascadeDeletingUIDs[action.payload];
  delete state.cascadeDeleteErrors[action.payload];
}

export function itemCascadeDeleteErrored(
  state: BrowseDashboardsState,
  action: PayloadAction<{ uid: string; errors: string[] }>
) {
  state.cascadeDeleteErrors[action.payload.uid] = action.payload.errors;
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

import { PayloadAction } from '@reduxjs/toolkit';

import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

import { BrowseDashboardsState } from '../types';

import { fetchChildren } from './actions';

type FetchChildrenAction = ReturnType<typeof fetchChildren.fulfilled>;

export function extraReducerFetchChildrenFulfilled(state: BrowseDashboardsState, action: FetchChildrenAction) {
  const parentUID = action.meta.arg;
  const children = action.payload;

  if (!parentUID) {
    state.rootItems = children;
    return;
  }

  state.childrenByParentUID[parentUID] = children;

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
  action: PayloadAction<{ item: Pick<DashboardViewItem, 'kind' | 'uid' | 'parentUID'>; isSelected: boolean }>
) {
  const { item, isSelected } = action.payload;

  // Selecting a folder selects all children, and unselecting a folder deselects all children
  // so propagate the new selection state to all descendants
  function markChildren(kind: DashboardViewItemKind, uid: string) {
    state.selectedItems[kind][uid] = isSelected;

    if (kind !== 'folder') {
      return;
    }

    let children = state.childrenByParentUID[uid] ?? [];
    for (const child of children) {
      markChildren(child.kind, child.uid);
    }
  }

  markChildren(item.kind, item.uid);

  // If all children of a folder are selected, then the folder is also selected.
  // If *any* child of a folder is unselelected, then the folder is alo unselected.
  // Reconcile all ancestors to make sure they're in the correct state.
  let nextParentUID = item.parentUID;

  while (nextParentUID) {
    const parent = findItem(state.rootItems ?? [], state.childrenByParentUID, nextParentUID);

    // This case should not happen, but a find can theortically return undefined, and it
    // helps limit infinite loops
    if (!parent) {
      break;
    }

    if (isSelected) {
      // If we're selecting an item, check all ancestors and see if all their children are
      // now selected and update them appropriately
      const children = state.childrenByParentUID[parent.uid];

      const allChildrenSelected = children?.every((v) => state.selectedItems[v.kind][v.uid]) ?? false;
      state.selectedItems[parent.kind][parent.uid] = allChildrenSelected;
    } else {
      // A folder cannot be selected if any of it's children are unselected
      state.selectedItems[parent.kind][parent.uid] = false;
    }

    nextParentUID = parent.parentUID;
  }

  // Check to see if we should mark the header checkbox selected if all root items are selected
  state.selectedItems.$all = state.rootItems?.every((v) => state.selectedItems[v.kind][v.uid]) ?? false;
}

export function setAllSelection(state: BrowseDashboardsState, action: PayloadAction<{ isSelected: boolean }>) {
  const { isSelected } = action.payload;

  state.selectedItems.$all = isSelected;

  // Search works a bit differently so the state here does different things...
  // In search:
  //  - When "Selecting all", it sends individual state updates with setItemSelectionState.
  //  - When "Deselecting all", it uses this setAllSelection. Search results aren't stored in
  //    redux, so we just need to iterate over the selected items to flip them to false

  if (isSelected) {
    for (const folderUID in state.childrenByParentUID) {
      const children = state.childrenByParentUID[folderUID] ?? [];

      for (const child of children) {
        state.selectedItems[child.kind][child.uid] = isSelected;
      }
    }

    for (const child of state.rootItems ?? []) {
      state.selectedItems[child.kind][child.uid] = isSelected;
    }
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

function findItem(
  rootItems: DashboardViewItem[],
  childrenByUID: Record<string, DashboardViewItem[] | undefined>,
  uid: string
): DashboardViewItem | undefined {
  for (const item of rootItems) {
    if (item.uid === uid) {
      return item;
    }
  }

  for (const parentUID in childrenByUID) {
    const children = childrenByUID[parentUID];
    if (!children) {
      continue;
    }

    for (const child of children) {
      if (child.uid === uid) {
        return child;
      }
    }
  }

  return undefined;
}

import { findItem } from './utils';
export function refetchChildrenFulfilled(state, action) {
    const { children, page, kind, lastPageOfKind } = action.payload;
    const { parentUID } = action.meta.arg;
    const newCollection = {
        items: children,
        lastFetchedKind: kind,
        lastFetchedPage: page,
        lastKindHasMoreItems: !lastPageOfKind,
        isFullyLoaded: kind === 'dashboard' && lastPageOfKind,
    };
    if (parentUID) {
        state.childrenByParentUID[parentUID] = newCollection;
    }
    else {
        state.rootItems = newCollection;
    }
}
export function fetchNextChildrenPageFulfilled(state, action) {
    var _a;
    const payload = action.payload;
    if (!payload) {
        // If not additional pages to load, the action returns undefined
        return;
    }
    const { children, page, kind, lastPageOfKind } = payload;
    const { parentUID, excludeKinds = [] } = action.meta.arg;
    const collection = parentUID ? state.childrenByParentUID[parentUID] : state.rootItems;
    const prevItems = (_a = collection === null || collection === void 0 ? void 0 : collection.items) !== null && _a !== void 0 ? _a : [];
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
export function setFolderOpenState(state, action) {
    const { folderUID, isOpen } = action.payload;
    state.openFolders[folderUID] = isOpen;
}
export function setItemSelectionState(state, 
// SearchView doesn't use DashboardViewItemKind (yet), so we pick just the specific properties
// we're interested in
action) {
    var _a, _b, _c, _d, _e;
    const { item, isSelected } = action.payload;
    // Selecting a folder selects all children, and unselecting a folder deselects all children
    // so propagate the new selection state to all descendants
    function markChildren(kind, uid) {
        var _a;
        state.selectedItems[kind][uid] = isSelected;
        if (kind !== 'folder') {
            return;
        }
        let collection = state.childrenByParentUID[uid];
        for (const child of (_a = collection === null || collection === void 0 ? void 0 : collection.items) !== null && _a !== void 0 ? _a : []) {
            markChildren(child.kind, child.uid);
        }
    }
    markChildren(item.kind, item.uid);
    // If all children of a folder are selected, then the folder is also selected.
    // If *any* child of a folder is unselelected, then the folder is alo unselected.
    // Reconcile all ancestors to make sure they're in the correct state.
    let nextParentUID = item.parentUID;
    while (nextParentUID) {
        const parent = findItem((_b = (_a = state.rootItems) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [], state.childrenByParentUID, nextParentUID);
        // This case should not happen, but a find can theortically return undefined, and it
        // helps limit infinite loops
        if (!parent) {
            break;
        }
        if (!isSelected) {
            // A folder cannot be selected if any of it's children are unselected
            state.selectedItems[parent.kind][parent.uid] = false;
        }
        nextParentUID = parent.parentUID;
    }
    // Check to see if we should mark the header checkbox selected if all root items are selected
    state.selectedItems.$all = (_e = (_d = (_c = state.rootItems) === null || _c === void 0 ? void 0 : _c.items) === null || _d === void 0 ? void 0 : _d.every((v) => state.selectedItems[v.kind][v.uid])) !== null && _e !== void 0 ? _e : false;
}
export function setAllSelection(state, action) {
    const { isSelected, folderUID: folderUIDArg } = action.payload;
    state.selectedItems.$all = isSelected;
    // Search works a bit differently so the state here does different things...
    // In search:
    //  - When "Selecting all", it sends individual state updates with setItemSelectionState.
    //  - When "Deselecting all", it uses this setAllSelection. Search results aren't stored in
    //    redux, so we just need to iterate over the selected items to flip them to false
    if (isSelected) {
        // Recursively select the children of the folder in view
        function selectChildrenOfFolder(folderUID) {
            const collection = folderUID ? state.childrenByParentUID[folderUID] : state.rootItems;
            // Bail early if the collection isn't found (not loaded yet)
            if (!collection) {
                return;
            }
            for (const child of collection.items) {
                state.selectedItems[child.kind][child.uid] = isSelected;
                if (child.kind !== 'folder') {
                    continue;
                }
                selectChildrenOfFolder(child.uid);
            }
        }
        selectChildrenOfFolder(folderUIDArg);
    }
    else {
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
//# sourceMappingURL=reducers.js.map
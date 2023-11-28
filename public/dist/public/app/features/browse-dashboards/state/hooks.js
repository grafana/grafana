import { useCallback, useRef } from 'react';
import { createSelector } from 'reselect';
import { useSelector, useDispatch } from 'app/types';
import { PAGE_SIZE } from '../api/services';
import { fetchNextChildrenPage } from './actions';
import { getPaginationPlaceholders } from './utils';
export const rootItemsSelector = (wholeState) => wholeState.browseDashboards.rootItems;
export const childrenByParentUIDSelector = (wholeState) => wholeState.browseDashboards.childrenByParentUID;
export const openFoldersSelector = (wholeState) => wholeState.browseDashboards.openFolders;
export const selectedItemsSelector = (wholeState) => wholeState.browseDashboards.selectedItems;
const flatTreeSelector = createSelector(rootItemsSelector, childrenByParentUIDSelector, openFoldersSelector, (wholeState, rootFolderUID) => rootFolderUID, (rootItems, childrenByParentUID, openFolders, folderUID) => {
    return createFlatTree(folderUID, rootItems, childrenByParentUID, openFolders);
});
const hasSelectionSelector = createSelector(selectedItemsSelector, (selectedItems) => {
    return Object.values(selectedItems).some((selectedItem) => Object.values(selectedItem).some((isSelected) => isSelected));
});
// Returns a DashboardTreeSelection but unselects any selected folder's children.
// This is useful when making backend requests to move or delete items.
// In this case, we only need to move/delete the parent folder and it will cascade to the children.
const selectedItemsForActionsSelector = createSelector(selectedItemsSelector, childrenByParentUIDSelector, (selectedItems, childrenByParentUID) => {
    // Take a copy of the selected items to work with
    // We don't care about panels here, only dashboards and folders can be moved or deleted
    const result = {
        dashboard: Object.assign({}, selectedItems.dashboard),
        folder: Object.assign({}, selectedItems.folder),
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
});
export function useBrowseLoadingStatus(folderUID) {
    return useSelector((wholeState) => {
        const children = folderUID
            ? wholeState.browseDashboards.childrenByParentUID[folderUID]
            : wholeState.browseDashboards.rootItems;
        return children ? 'fulfilled' : 'pending';
    });
}
export function useFlatTreeState(folderUID) {
    return useSelector((state) => flatTreeSelector(state, folderUID));
}
export function useHasSelection() {
    return useSelector((state) => hasSelectionSelector(state));
}
export function useCheckboxSelectionState() {
    return useSelector(selectedItemsSelector);
}
export function useChildrenByParentUIDState() {
    return useSelector((wholeState) => wholeState.browseDashboards.childrenByParentUID);
}
export function useActionSelectionState() {
    return useSelector((state) => selectedItemsForActionsSelector(state));
}
export function useLoadNextChildrenPage(excludeKinds = []) {
    const dispatch = useDispatch();
    const requestInFlightRef = useRef(false);
    const handleLoadMore = useCallback((folderUID) => {
        if (requestInFlightRef.current) {
            return Promise.resolve();
        }
        requestInFlightRef.current = true;
        const promise = dispatch(fetchNextChildrenPage({ parentUID: folderUID, excludeKinds, pageSize: PAGE_SIZE }));
        promise.finally(() => (requestInFlightRef.current = false));
        return promise;
    }, [dispatch, excludeKinds]);
    return handleLoadMore;
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
export function createFlatTree(folderUID, rootCollection, childrenByUID, openFolders, level = 0, excludeKinds = [], excludeUIDs = []) {
    function mapItem(item, parentUID, level) {
        var _a;
        if (excludeKinds.includes(item.kind) || excludeUIDs.includes(item.uid)) {
            return [];
        }
        const mappedChildren = createFlatTree(item.uid, rootCollection, childrenByUID, openFolders, level + 1, excludeKinds, excludeUIDs);
        const isOpen = Boolean(openFolders[item.uid]);
        const emptyFolder = ((_a = childrenByUID[item.uid]) === null || _a === void 0 ? void 0 : _a.items.length) === 0;
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
        return [thisItem, ...mappedChildren];
    }
    const isOpen = (folderUID && openFolders[folderUID]) || level === 0;
    const collection = folderUID ? childrenByUID[folderUID] : rootCollection;
    const items = folderUID
        ? isOpen && (collection === null || collection === void 0 ? void 0 : collection.items) // keep seperate lines
        : collection === null || collection === void 0 ? void 0 : collection.items;
    let children = (items || []).flatMap((item) => {
        return mapItem(item, folderUID, level);
    });
    // this is very custom to the folder picker right now
    // we exclude dashboards, but if you have more than 1 page of dashboards collection.isFullyLoaded is false
    // so we need to check that we're ignoring dashboards and we've fetched all the folders
    // TODO generalize this properly (e.g. split state by kind?)
    const isConsideredLoaded = excludeKinds.includes('dashboard') && (collection === null || collection === void 0 ? void 0 : collection.lastFetchedKind) === 'dashboard';
    const showPlaceholders = (level === 0 && !collection) || (isOpen && collection && !(collection.isFullyLoaded || isConsideredLoaded));
    if (showPlaceholders) {
        children = children.concat(getPaginationPlaceholders(PAGE_SIZE, folderUID, level));
    }
    return children;
}
//# sourceMappingURL=hooks.js.map
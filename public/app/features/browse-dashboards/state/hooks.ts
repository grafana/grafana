import { useCallback, useEffect, useRef } from 'react';
import { createSelector } from 'reselect';

import { DashboardViewItem } from 'app/features/search/types';
import { useSelector, StoreState, useDispatch } from 'app/types';

import { endpoints } from '../api/browseDashboardsAPI';
import { ROOT_PAGE_SIZE } from '../api/services';
import { BrowseDashboardsState, DashboardsTreeItem, DashboardTreeSelection } from '../types';

export const rootItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.rootItems;
export const childrenByParentUIDSelector = (wholeState: StoreState) => wholeState.browseDashboards.childrenByParentUID;
export const openFoldersSelector = (wholeState: StoreState) => wholeState.browseDashboards.openFolders;
export const selectedItemsSelector = (wholeState: StoreState) => wholeState.browseDashboards.selectedItems;

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
  const rootItems = useSelector(rootItemsSelector);
  const childrenByParentUID = useSelector(childrenByParentUIDSelector);
  const openFolders = useSelector(openFoldersSelector);
  const handleSubscription = useHandleSubscription();

  return createFlatTree(folderUID, rootItems, childrenByParentUID, openFolders, handleSubscription);
}

export function useHandleSubscription() {
  type RtkQuerySubscription = ReturnType<ReturnType<typeof endpoints.getFolderChildren.initiate>>;
  const subscriptions = useRef<Record<string, RtkQuerySubscription>>({});
  const dispatch = useDispatch();
  const childrenByParentUID = useSelector(childrenByParentUIDSelector);

  const handleSubscription = useCallback(
    (folderUID: string, isOpen: boolean) => {
      if (isOpen) {
        // Register a subscription for this folder if it doesn't already exist
        if (!subscriptions.current[folderUID]) {
          const subscription = dispatch(endpoints.getFolderChildren.initiate(folderUID));
          subscriptions.current[folderUID] = subscription;
        }
      } else {
        const subscription = subscriptions.current[folderUID];
        // Unsubscribe and delete subscription if it exists
        if (subscription) {
          subscription.unsubscribe();
          delete subscriptions.current[folderUID];
        }
        // Recursively unsubscribe from all children
        const children = childrenByParentUID[folderUID];
        if (children && children.items.length > 0) {
          children.items.forEach((child) => {
            if (child.kind === 'folder') {
              handleSubscription(child.uid, isOpen);
            }
          });
        }
      }
    },
    [childrenByParentUID, subscriptions, dispatch]
  );

  useEffect(() => {
    const subscriptionsCopy = subscriptions.current;
    return () => {
      Object.values(subscriptionsCopy).forEach((subscription) => {
        subscription.unsubscribe();
      });
    };
  }, []);

  return handleSubscription;
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
  rootCollection: BrowseDashboardsState['rootItems'],
  childrenByUID: BrowseDashboardsState['childrenByParentUID'],
  openFolders: Record<string, boolean>,
  handleSubscription: (folderUID: string, isOpen: boolean) => void,
  level = 0
): DashboardsTreeItem[] {
  function mapItem(item: DashboardViewItem, parentUID: string | undefined, level: number): DashboardsTreeItem[] {
    const mappedChildren = createFlatTree(
      item.uid,
      rootCollection,
      childrenByUID,
      openFolders,
      handleSubscription,
      level + 1
    );

    const isOpen = Boolean(openFolders[item.uid]);
    handleSubscription(item.uid, isOpen);
    const emptyFolder = childrenByUID[item.uid]?.items.length === 0;
    if (isOpen && emptyFolder) {
      mappedChildren.push({
        isOpen: false,
        level: level + 1,
        item: { kind: 'ui', uiKind: 'empty-folder', uid: item.uid + 'empty-folder' },
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
    ? isOpen && collection?.items // keep seperate lines
    : collection?.items;

  let children = (items || []).flatMap((item) => mapItem(item, folderUID, level));

  if (level === 0 && (!collection || !collection.isFullyLoaded)) {
    children = children.concat(getPaginationPlaceholders(ROOT_PAGE_SIZE, folderUID, level));
  }

  return children;
}

function getPaginationPlaceholders(amount: number, parentUID: string | undefined, level: number) {
  return new Array(amount).fill(null).map((_, index) => {
    return {
      parentUID,
      level,
      isOpen: false,
      item: {
        kind: 'ui' as const,
        uiKind: 'pagination-placeholder' as const,
        uid: `${parentUID}-pagination-${index}`,
      },
    };
  });
}

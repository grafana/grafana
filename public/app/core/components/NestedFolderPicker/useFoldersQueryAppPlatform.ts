import { createSelector } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { getMessageFromError } from 'app/core/utils/errors';
import { type DashboardViewItemWithUIItems, type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { isRootFolderUID } from 'app/features/search/constants';
import { useDispatch, useSelector } from 'app/types/store';

import { type ManagerKind } from '../../../features/apiserver/types';
import { PAGE_SIZE } from '../../../features/browse-dashboards/api/constants';
import { getPaginationPlaceholders } from '../../../features/browse-dashboards/state/utils';

import { type UseFoldersQueryProps } from './useFoldersQuery';
import { useSelectableFolders } from './useSelectableFolders';
import { getRootFolderItem } from './utils';

type FolderChildrenSelector =
  | ReturnType<typeof dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select>
  | ReturnType<typeof dashboardAPIv0alpha1.endpoints.searchFolderChildrenPage.select>;
type GetFolderChildrenQuery = ReturnType<FolderChildrenSelector>;
type GetFolderChildrenRequest = {
  unsubscribe: () => void;
};

const rootFolderToken = 'general';
const sharedWithMeFolderToken = 'sharedwithme';
const collator = new Intl.Collator();

/**
 * Returns a loaded folder hierarchy as a flat list and a function to load folders.
 * This version uses the app platform search API. When read only folders are shown, every folder is listed, so children
 * are loaded a page at a time. Otherwise each parent's children come back in a single response.
 */
export function useFoldersQueryAppPlatform({
  isBrowsing,
  openFolders,
  /* rootFolderUID: configure which folder to start browsing from */
  rootFolderUID,
  rootFolderItem,
  permission,
  showReadOnly,
}: UseFoldersQueryProps) {
  const dispatch = useDispatch();

  // Keep a list of all request subscriptions so we can unsubscribe from them when the component is unmounted
  const requestsRef = useRef<GetFolderChildrenRequest[]>([]);

  // Set of UIDs for which children were requested but were empty.
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  function addEmptyFolder(folderUid: string) {
    setEmptyFolders((prev) => new Set(prev).add(folderUid));
  }

  // Keep a list of selectors for dynamic state selection
  const [selectors, setSelectors] = useState<FolderChildrenSelector[]>([]);

  // This is an aggregated dynamic selector of all the selectors for all the request issued while loading the folder
  // tree and returns the whole tree that was loaded so far.
  const listAllFoldersSelector = useMemo(() => {
    return createSelector(selectors, (...responses) => {
      // Returns loading true if any of the responses is still loading
      let isLoading = false;
      let error: unknown = undefined;

      // Keyed by parent, then by page offset, so a repeated request replaces its page instead of adding one
      const pagesByOffsetByParent: Record<string, Record<number, GetFolderChildrenQuery>> = {};

      for (const response of responses) {
        if (response.status === QueryStatus.pending) {
          isLoading = true;
        }

        if (!error && response.error) {
          error = response.error;
        }

        const parentName = response.originalArgs?.folder;
        if (parentName) {
          const offset = getPageOffset(response);
          pagesByOffsetByParent[parentName] = { ...pagesByOffsetByParent[parentName], [offset]: response };
        }
      }

      const pagesByParent: Record<string, GetFolderChildrenQuery[]> = {};
      for (const [parentName, pagesByOffset] of Object.entries(pagesByOffsetByParent)) {
        pagesByParent[parentName] = Object.values(pagesByOffset).sort((a, b) => getPageOffset(a) - getPageOffset(b));
      }

      return {
        isLoading,
        error,
        pagesByParent,
      };
    });
  }, [selectors]);

  const state = useSelector(listAllFoldersSelector);

  const pagesByKey = useMemo(() => {
    const pages: Record<string, GetFolderChildrenQuery> = {};
    for (const [parentName, parentPages] of Object.entries(state.pagesByParent)) {
      for (const page of parentPages) {
        pages[getPageKey(parentName, page)] = page;
      }
    }
    return pages;
  }, [state.pagesByParent]);

  const selectableState = useSelectableFolders(pagesByKey, Boolean(showReadOnly));

  // Loads folders for the given parent UID
  const requestNextPage = useCallback(
    (parentUid: string | undefined) => {
      const finalParentUid = parentUid ?? rootFolderToken;
      const pages = state.pagesByParent[finalParentUid] ?? [];

      // If already loading, or every page has loaded, don't request again
      if (pages.some((page) => page.status === QueryStatus.pending) || isComplete(pages, showReadOnly)) {
        return;
      }

      let subscription: GetFolderChildrenRequest;
      let selector: FolderChildrenSelector;
      if (showReadOnly) {
        // Every folder is listed, so page through them. Selectability comes from a separate check.
        const loadedPages = pages.filter((page) => page.data);
        const args = { folder: finalParentUid, limit: PAGE_SIZE, offset: loadedPages.length * PAGE_SIZE };
        subscription = dispatch(dashboardAPIv0alpha1.endpoints.searchFolderChildrenPage.initiate(args));
        selector = dashboardAPIv0alpha1.endpoints.searchFolderChildrenPage.select(args);
      } else {
        const args = { folder: finalParentUid, type: 'folder', permission } as const;
        subscription = dispatch(dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate(args));
        selector = dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select(args);
      }

      // Add selector for the response to the list so we can then have an aggregated selector for all the folders
      setSelectors((selectors) => selectors.concat(selector));

      // the subscriptions are saved in a ref so they can be unsubscribed on unmount
      requestsRef.current = requestsRef.current.concat([subscription]);
    },
    [state, dispatch, permission, showReadOnly]
  );

  // Unsubscribe from all requests when the component is unmounted
  useEffect(() => {
    return () => {
      for (const req of requestsRef.current) {
        req.unsubscribe();
      }
    };
  }, []);

  // Convert the individual responses into a flat list of folders, with level indicating
  // the depth in the hierarchy.
  const treeList = useMemo(() => {
    if (!isBrowsing) {
      return [];
    }

    function createFlatList(
      parentUid: string,
      pages: GetFolderChildrenQuery[],
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> {
      const { hits, selectable, isFullyShown } = getShownPages(parentUid, pages);

      let folders = [...hits];
      // Paged children keep the server's title order, so each new page only appends to the rows already shown
      if (!showReadOnly) {
        folders.sort((a, b) => collator.compare(a.title, b.title));
      }

      // Add virtual "Shared with me" folder under the top-level "Dashboards" root.
      // This is backed by the same search endpoint, using `folder=sharedwithme`.
      // Should show whatever folders are not accessible by traversing from the general/root folder.
      if (parentUid === rootFolderToken && rootFolderUID === undefined) {
        folders = [makeSharedWithMeFolder(), ...folders];
      }

      const list: DashboardsTreeItem[] = folders.flatMap((item) => {
        const name = item.name;
        const folderIsOpen = openFolders[name];
        const isReadOnly = showReadOnly && name !== sharedWithMeFolderToken && !selectable.has(name);
        const flatItem: DashboardsTreeItem = {
          isOpen: Boolean(folderIsOpen),
          level: level,
          disabled: item.name === sharedWithMeFolderToken || isReadOnly,
          readOnly: isReadOnly || undefined,
          item: {
            kind: 'folder' as const,
            title: item.title,
            // We use resource name as UID because well, not sure what metadata.uid would be used for now as you cannot
            // query by it.
            uid: name,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            managedBy: item.managedBy?.kind as ManagerKind | undefined,
            managerId: item.managedBy?.id,
            parentUID: isRootFolderUID(item.folder) ? undefined : item.folder,
          },
        };

        const childPages = folderIsOpen ? state.pagesByParent[name] : undefined;
        if (childPages?.length) {
          // If we finished loading and there are no children add folder to empty folders list so we don't show
          // the caret next to the folder anymore
          if (isEmptyResponse(childPages[0])) {
            addEmptyFolder(name);
          }
          const childFlatItems = createFlatList(name, childPages, level + 1);
          return [flatItem, ...childFlatItems];
        }

        return flatItem;
      });

      // We could return early but we are adding the "shared with me" folder statically, so even if response is empty
      // there could be a folder to process
      if (pages.length === 0 || (showReadOnly && !isFullyShown)) {
        // The pagination placeholders are what actually triggers the call to the next page. So if there is no response,
        // meaning to request for some children, or more pages to load, we add these placeholders, and they will trigger
        // the load.
        list.push(...getPaginationPlaceholders(PAGE_SIZE, parentUid, level));
      }
      return list;
    }

    // The children to show so far: every loaded page in order, stopping at the first one still loading or, when read
    // only folders are shown, still waiting for its selectability check, so read only folders never look selectable
    function getShownPages(parentUid: string, pages: GetFolderChildrenQuery[]) {
      const hits: DashboardHit[] = [];
      const selectable = new Set<string>();

      for (const page of pages) {
        if (page.status === QueryStatus.rejected) {
          // The error is shown instead, and placeholders would only request the failed page again
          return { hits, selectable, isFullyShown: true };
        }
        const pageSelectable = selectableState.selectableByKey[getPageKey(parentUid, page)];
        if (!page.data || (showReadOnly && page.data.hits.length > 0 && !pageSelectable)) {
          return { hits, selectable, isFullyShown: false };
        }
        hits.push(...page.data.hits);
        pageSelectable?.forEach((name) => selectable.add(name));
      }

      return { hits, selectable, isFullyShown: isComplete(pages, showReadOnly) };
    }

    const startingToken = rootFolderUID ?? rootFolderToken;
    const rootFlatTree = createFlatList(startingToken, state.pagesByParent[startingToken] ?? [], 1);
    rootFlatTree.unshift(rootFolderItem || getRootFolderItem());

    return rootFlatTree;
  }, [state, selectableState, showReadOnly, isBrowsing, openFolders, rootFolderUID, rootFolderItem]);

  const error = state.error ?? selectableState.error;

  return {
    emptyFolders,
    items: treeList,
    isLoading: state.isLoading || selectableState.isLoading,
    error: error ? new Error(getMessageFromError(error)) : undefined,
    requestNextPage,
  };
}

function makeSharedWithMeFolder() {
  return {
    name: sharedWithMeFolderToken,
    title: t('browse-dashboards.folder-picker.shared-with-me', 'Shared with me'),
    folder: rootFolderToken,
    resource: 'folder',
  };
}

// Without read only folders, a parent's children come back in a single response. With them, children are paged, and a
// short page is the last one.
function isComplete(pages: GetFolderChildrenQuery[], showReadOnly?: boolean) {
  const lastPage = pages.at(-1);
  if (!lastPage?.data) {
    return false;
  }
  return !showReadOnly || lastPage.data.hits.length < PAGE_SIZE;
}

function getPageOffset(page: GetFolderChildrenQuery) {
  return page.originalArgs && 'offset' in page.originalArgs ? page.originalArgs.offset : 0;
}

function getPageKey(parentName: string, page: GetFolderChildrenQuery) {
  return `${parentName}@${getPageOffset(page)}`;
}

function isEmptyResponse(response: { data?: { hits: unknown[] }; status: QueryStatus }) {
  return response.data && response.status !== QueryStatus.pending && response.data.hits.length === 0;
}

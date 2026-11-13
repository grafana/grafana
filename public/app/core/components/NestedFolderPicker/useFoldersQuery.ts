import { createSelector } from '@reduxjs/toolkit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type DashboardSearchResults,
  type SearchDashboardsAndFoldersApiArg,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { getMessageFromError } from 'app/core/utils/errors';
import { type DashboardViewItemWithUIItems, type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { isRootFolderUID } from 'app/features/search/constants';
import { useDispatch, useSelector } from 'app/types/store';

import { type ManagerKind } from '../../../features/apiserver/types';
import { PAGE_SIZE } from '../../../features/browse-dashboards/api/constants';
import { getPaginationPlaceholders } from '../../../features/browse-dashboards/state/utils';

import { getRootFolderItem } from './utils';

export interface UseFoldersQueryProps {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  /** With create, only list folders on the way to one the user can create dashboards in, and mark the ones they cannot as read only */
  permission?: SearchDashboardsAndFoldersApiArg['permission'];
  rootFolderUID?: string;
  rootFolderItem?: DashboardsTreeItem;
}

const rootFolderToken = 'general';
const sharedWithMeFolderToken = 'sharedwithme';

interface FolderChildrenArgs {
  folder: string;
  permission: SearchDashboardsAndFoldersApiArg['permission'];
  include?: 'pathToCreatable';
}

const folderChildrenAPI = dashboardAPIv0alpha1.injectEndpoints({
  endpoints: (build) => ({
    /**
     * One cache entry per parent folder, holding every page loaded so far. Only the offset varies between pages,
     * so the fixed filters stay out of the cache key.
     */
    searchFolderChildren: build.infiniteQuery<DashboardSearchResults, FolderChildrenArgs, number>({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage, _allPages, lastOffset) => {
          const nextOffset = lastOffset + lastPage.hits.length;
          // Post-rank authorization can fill a page only partially and still have rows to give, so a short page is
          // not the end. totalHits is exact or an overcount, so reaching it is.
          return lastPage.hits.length === 0 || nextOffset >= lastPage.totalHits ? undefined : nextOffset;
        },
      },
      query: ({ queryArg, pageParam }) => ({
        url: '/search',
        params: { ...queryArg, type: 'folder', sort: 'title', limit: PAGE_SIZE, offset: pageParam },
      }),
      providesTags: ['Search'],
    }),
  }),
});

const { searchFolderChildren } = folderChildrenAPI.endpoints;

type FolderChildrenSelector = ReturnType<typeof searchFolderChildren.select>;
type FolderChildrenRequest = {
  unsubscribe: () => void;
};

interface FolderChildren {
  folders: DashboardSearchResults['hits'];
  isLoading: boolean;
  /** Rows still to load, capped at one page; 0 once every page has loaded */
  pendingCount: number;
}

/**
 * Returns a loaded folder hierarchy as a flat list and a function to load more pages. Children are fetched per parent
 * through the dashboard search API, one page of PAGE_SIZE at a time.
 */
export function useFoldersQuery({
  isBrowsing,
  openFolders,
  /* rootFolderUID: configure which folder to start browsing from */
  rootFolderUID,
  rootFolderItem,
  permission,
}: UseFoldersQueryProps) {
  const dispatch = useDispatch();

  // One subscription per parent. The cache entries are keyed by permission too, so a permission change releases
  // them and the tree reloads under the new one.
  const requestsRef = useRef(new Map<string, FolderChildrenRequest>());

  // One selector per requested parent, so the aggregated selector below can read every loaded subtree
  const [selectors, setSelectors] = useState<FolderChildrenSelector[]>([]);

  const listAllFoldersSelector = useMemo(() => {
    return createSelector(selectors, (...responses) => {
      let isLoading = false;
      let error: unknown = undefined;
      const childrenByParent: Record<string, FolderChildren> = {};
      // Parents whose children were fully loaded and came back empty, so the caret can be hidden
      const emptyFolders = new Set<string>();

      for (const response of responses) {
        const parentName = response.originalArgs?.folder;
        if (!parentName) {
          continue;
        }

        isLoading ||= response.isLoading;
        error ??= response.error;

        const folders = response.data?.pages.flatMap((page) => page.hits) ?? [];
        const pendingCount = countPendingRows(response.data?.pages.at(-1), response.hasNextPage, folders.length);
        childrenByParent[parentName] = { folders, isLoading: response.isLoading, pendingCount };
        if (pendingCount === 0 && folders.length === 0) {
          emptyFolders.add(parentName);
        }
      }

      return { isLoading, error, childrenByParent, emptyFolders };
    });
  }, [selectors]);

  const state = useSelector(listAllFoldersSelector);

  // Loads the next page of children for the given parent UID; a failed page is retried by requesting it again
  const requestNextPage = useCallback(
    (parentUid: string | undefined) => {
      const finalParentUid = parentUid ?? rootFolderToken;
      const children = state.childrenByParent[finalParentUid];

      if (children?.isLoading || children?.pendingCount === 0) {
        return;
      }

      // Keep a create filter, so a server that ignores `include` still only lists folders the user can pick
      const args: FolderChildrenArgs = {
        folder: finalParentUid,
        permission,
        include: permission === 'create' ? 'pathToCreatable' : undefined,
      };

      // The first request creates the subscription; later ones extend the same cache entry by one page
      if (requestsRef.current.has(finalParentUid)) {
        dispatch(searchFolderChildren.initiate(args, { subscribe: false, direction: 'forward' }));
        return;
      }

      requestsRef.current.set(finalParentUid, dispatch(searchFolderChildren.initiate(args)));
      setSelectors((selectors) => selectors.concat(searchFolderChildren.select(args)));
    },
    [state, dispatch, permission]
  );

  // Release the loaded tree when the permission changes or the component unmounts
  useEffect(() => {
    const requests = requestsRef.current;
    return () => {
      for (const req of requests.values()) {
        req.unsubscribe();
      }
      requests.clear();
      setSelectors([]);
    };
  }, [permission]);

  // Convert the individual responses into a flat list of folders, with level indicating
  // the depth in the hierarchy.
  const treeList = useMemo(() => {
    if (!isBrowsing) {
      return [];
    }

    function createFlatList(
      parentUid: string,
      children: FolderChildren | undefined,
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> {
      // Pages arrive in server order (sorted by title), so no client-side sort is needed
      let folders = children?.folders ?? [];

      // Add virtual "Shared with me" folder under the top-level "Dashboards" root.
      // This is backed by the same search endpoint, using `folder=sharedwithme`.
      // Should show whatever folders are not accessible by traversing from the general/root folder.
      if (parentUid === rootFolderToken && rootFolderUID === undefined) {
        folders = [makeSharedWithMeFolder(), ...folders];
      }

      const list: DashboardsTreeItem[] = folders.flatMap((item) => {
        const name = item.name;
        const folderIsOpen = openFolders[name];
        // Only a folder the server marks as not creatable is read only
        const readOnly = permission === 'create' && item.field?.canCreate === false;
        const flatItem: DashboardsTreeItem = {
          isOpen: Boolean(folderIsOpen),
          level: level,
          disabled: item.name === sharedWithMeFolderToken || readOnly,
          readOnly,
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

        const childItems = folderIsOpen && state.childrenByParent[name];
        if (childItems) {
          const childFlatItems = createFlatList(name, childItems, level + 1);
          return [flatItem, ...childFlatItems];
        }

        return flatItem;
      });

      // We could return early but we are adding the "shared with me" folder statically, so even if response is empty
      // there could be a folder to process.
      // The pagination placeholders are what actually triggers the call to the next page.
      list.push(...getPaginationPlaceholders(children?.pendingCount ?? PAGE_SIZE, parentUid, level));
      return list;
    }

    const startingToken = rootFolderUID ?? rootFolderToken;
    const rootFlatTree = createFlatList(startingToken, state.childrenByParent[startingToken], 1);
    rootFlatTree.unshift(rootFolderItem || getRootFolderItem());

    return rootFlatTree;
  }, [state, isBrowsing, openFolders, rootFolderUID, rootFolderItem, permission]);

  return {
    emptyFolders: state.emptyFolders,
    items: treeList,
    isLoading: state.isLoading,
    error: state.error ? new Error(getMessageFromError(state.error)) : undefined,
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

function countPendingRows(lastPage: DashboardSearchResults | undefined, hasNextPage: boolean, loaded: number) {
  if (!lastPage) {
    // Nothing has loaded, so the size is unknown
    return PAGE_SIZE;
  }
  // Sized to the rows still on the server, so the list keeps its height when the last page lands. totalHits is exact
  // or an overcount, so this never shows too few.
  return hasNextPage ? Math.min(PAGE_SIZE, lastPage.totalHits - loaded) : 0;
}

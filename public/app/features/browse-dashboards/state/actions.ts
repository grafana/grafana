import { STARRED_FOLDERS_UID, TEAM_FOLDERS_UID, isRootFolderUID } from 'app/features/search/constants';
import { type DashboardViewItem, type DashboardViewItemKind } from 'app/features/search/types';
import { createAsyncThunk } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { listDashboards, listFolders, listStarredFolders, listTeamFolders } from '../api/services';
import { type BrowseDashboardsState, type DashboardViewItemWithUIItems, type UIDashboardViewItem } from '../types';
import { reapplyVirtualFolderPrefix, stripVirtualFolderPrefix } from '../utils/dashboards';

import {
  collectionGeneration,
  collectionKeyOf,
  findItem,
  planRepositoryRefresh,
  type PulledRepository,
  type ViewedFolder,
} from './utils';

async function listSafe(label: string, load: () => Promise<DashboardViewItem[]>): Promise<DashboardViewItem[]> {
  try {
    return await load();
  } catch (error) {
    console.error(`Failed to load ${label}`, error);
    return [];
  }
}

interface FetchNextChildrenPageArgs {
  parentUID: string | undefined;

  // Allow UI items to be excluded (they're always excluded) for convenience for callers
  excludeKinds?: Array<DashboardViewItemWithUIItems['kind'] | UIDashboardViewItem['uiKind']>;
  pageSize: number;
}

interface LoadedChildren {
  children: DashboardViewItem[];
  kind: 'folder' | 'dashboard';
  page: number;
  lastPageOfKind: boolean;
}

/** A load also reports the collection generation it started from; the reducer drops it if that moved. */
interface FetchNextChildrenPageResult extends LoadedChildren {
  generation: number;
}

interface RefetchChildrenArgs {
  parentUID: string | undefined;
  pageSize: number;
}

interface RefetchChildrenResult extends LoadedChildren {
  generation: number;
}

interface RefreshParentsArgs {
  kind: DashboardViewItemKind;
  uids: string[];
}

interface RefreshTreeArgs {
  repository: PulledRepository;
  viewed: ViewedFolder;
  /** `finished` of the pull; stamped for the repository on success. */
  syncedAt: number;
}

export const refreshParents = createAsyncThunk(
  'browseDashboards/refreshParents',
  async ({ kind, uids }: RefreshParentsArgs, { getState, dispatch }) => {
    const { browseDashboards } = getState();
    const { rootItems, childrenByParentUID } = browseDashboards;
    const parentsToRefresh = new Set<string | undefined>();

    for (const uid of uids) {
      // find the parent folder uid
      const item = findItem(rootItems?.items ?? [], childrenByParentUID, kind, uid);
      parentsToRefresh.add(item?.parentUID);
    }

    for (const parentUID of parentsToRefresh) {
      dispatch(refetchChildren({ parentUID, pageSize: PAGE_SIZE }));
    }
  }
);

/**
 * Brings the tree back in step with a completed pull of one repository: the pending reducer drops
 * the collections the pull may have changed that are off screen, and the ones on screen are
 * refetched here in place. The fulfilled reducer stamps the repository, so a failed refetch
 * leaves the tree marked stale and the next visit tries again.
 */
export const refreshTree = createAsyncThunk(
  'browseDashboards/refreshTree',
  async ({ repository, viewed }: RefreshTreeArgs, { getState, dispatch }) => {
    const { refetch } = planRepositoryRefresh(getState().browseDashboards, repository, viewed);
    await Promise.all(
      refetch.map((parentUID) => dispatch(refetchChildren({ parentUID, pageSize: PAGE_SIZE })).unwrap())
    );
  }
);

/**
 * Refetches children of a folder after changes that should be reflected in the redux state which is then rendered
 * in the dashboard browse page.
 *
 * For this to work properly the requests have to be uncached themselves here so make sure any RTK query used here
 * does not use builtin cache.
 */
export const refetchChildren = createAsyncThunk(
  'browseDashboards/refetchChildren',
  async ({ parentUID, pageSize }: RefetchChildrenArgs, { getState }): Promise<RefetchChildrenResult> => {
    const generation = collectionGeneration(getState().browseDashboards, collectionKeyOf(parentUID));
    return { ...(await loadFirstPage(parentUID, pageSize)), generation };
  }
);

async function loadFirstPage(parentUID: string | undefined, pageSize: number): Promise<LoadedChildren> {
  if (parentUID === TEAM_FOLDERS_UID) {
    const children = await listSafe('team folders', listTeamFolders);
    return { children, kind: 'dashboard', page: 1, lastPageOfKind: true };
  }

  if (parentUID === STARRED_FOLDERS_UID) {
    const children = await listSafe('starred folders', listStarredFolders);
    return { children, kind: 'dashboard', page: 1, lastPageOfKind: true };
  }

  const strippedUID = parentUID ? stripVirtualFolderPrefix(parentUID) : parentUID;
  const uid = isRootFolderUID(strippedUID) ? undefined : strippedUID;

  // At the moment this will just clear out all loaded children and refetch the first page.
  // If user has scrolled beyond the first page, then InfiniteLoader will probably trigger
  // an additional page load (via fetchNextChildrenPage)

  let page = 1;
  let fetchKind: DashboardViewItemKind | undefined = 'folder';

  let children = await listFolders(uid, undefined, page, pageSize);
  let lastPageOfKind = children.length < pageSize;

  // If we've loaded all folders, load the first page of dashboards.
  // This ensures dashboards are loaded if a folder contains only dashboards.
  if (fetchKind === 'folder' && lastPageOfKind) {
    fetchKind = 'dashboard';
    page = 1;

    const childDashboards = await listDashboards(uid, page, pageSize);
    lastPageOfKind = childDashboards.length < pageSize;
    children = children.concat(childDashboards);
  }

  // Propagate the virtual prefix to all descendants so they get independent expand/collapse state
  if (parentUID && parentUID !== strippedUID) {
    children = children.map((child) => ({
      ...child,
      uid: reapplyVirtualFolderPrefix(parentUID, child.uid),
    }));
  }

  return {
    children,
    lastPageOfKind: lastPageOfKind,
    page,
    kind: fetchKind,
  };
}

export const fetchNextChildrenPage = createAsyncThunk(
  'browseDashboards/fetchNextChildrenPage',
  async (args: FetchNextChildrenPageArgs, { getState }): Promise<undefined | FetchNextChildrenPageResult> => {
    const key = collectionKeyOf(args.parentUID);

    // The collection may be dropped, marked for refresh or replaced while a page is in flight (a
    // refetch after a delete, a repository pull), making the page part of an old listing. The tree's
    // loader is still waiting on this promise and will not ask again, so load against the current
    // listing instead of appending or giving up.
    for (;;) {
      const generation = collectionGeneration(getState().browseDashboards, key);
      const loaded = await loadNextPage(args, getState().browseDashboards);
      if (!loaded) {
        return undefined;
      }
      if (generation === collectionGeneration(getState().browseDashboards, key)) {
        return { ...loaded, generation };
      }
    }
  }
);

async function loadNextPage(
  { parentUID, excludeKinds = [], pageSize }: FetchNextChildrenPageArgs,
  state: BrowseDashboardsState
): Promise<undefined | LoadedChildren> {
  if (parentUID === TEAM_FOLDERS_UID) {
    const collection = state.childrenByParentUID[parentUID];
    if (collection?.isFullyLoaded) {
      return undefined;
    }
    const children = await listSafe('team folders', listTeamFolders);
    return { children, kind: 'dashboard', page: 1, lastPageOfKind: true };
  }

  if (parentUID === STARRED_FOLDERS_UID) {
    const collection = state.childrenByParentUID[parentUID];
    if (collection?.isFullyLoaded) {
      return undefined;
    }
    const children = await listSafe('starred folders', listStarredFolders);
    return { children, kind: 'dashboard', page: 1, lastPageOfKind: true };
  }

  // TODO: invert prop to `includeKinds`, but also support not loading folders
  const loadDashboards = !excludeKinds.includes('dashboard');

  const strippedUID = parentUID ? stripVirtualFolderPrefix(parentUID) : parentUID;
  const uid = isRootFolderUID(strippedUID) ? undefined : strippedUID;

  const collectionKey = collectionKeyOf(parentUID);
  const collection = collectionKey ? state.childrenByParentUID[collectionKey] : state.rootItems;

  let page = 1;
  let fetchKind: DashboardViewItemKind | undefined = undefined;

  // Folder children do not come from a single API, so we need to do a bunch of logic to determine
  // which page of which kind to load

  if (!collection) {
    // No previous data in store, fetching first page of folders
    page = 1;
    fetchKind = 'folder';
  } else if (collection.lastFetchedKind === 'dashboard' && !collection.lastKindHasMoreItems) {
    // Nothing left to load. Reached when a page is reloaded after its collection was replaced by
    // a listing that fits in one page.
  } else if (collection.lastFetchedKind === 'folder' && collection.lastKindHasMoreItems) {
    // Load additional pages of folders
    page = collection.lastFetchedPage + 1;
    fetchKind = 'folder';
  } else if (loadDashboards) {
    // We've already checked if there's more folders to load, so if the last fetched is folder
    // then we fetch first page of dashboards
    page = collection.lastFetchedKind === 'folder' ? 1 : collection.lastFetchedPage + 1;
    fetchKind = 'dashboard';
  }

  if (!fetchKind) {
    return undefined;
  }

  let children =
    fetchKind === 'folder'
      ? await listFolders(uid, undefined, page, pageSize)
      : await listDashboards(uid, page, pageSize);

  let lastPageOfKind = children.length < pageSize;

  // If we've loaded all folders, load the first page of dashboards.
  // This ensures dashboards are loaded if a folder contains only dashboards.
  if (fetchKind === 'folder' && lastPageOfKind && loadDashboards) {
    fetchKind = 'dashboard';
    page = 1;

    const childDashboards = await listDashboards(uid, page, pageSize);
    lastPageOfKind = childDashboards.length < pageSize;
    children = children.concat(childDashboards);
  }

  // Propagate the virtual prefix to all descendants so they get independent expand/collapse state
  if (parentUID && parentUID !== strippedUID) {
    children = children.map((child) => ({
      ...child,
      uid: reapplyVirtualFolderPrefix(parentUID, child.uid),
    }));
  }

  return {
    children,
    lastPageOfKind,
    page,
    kind: fetchKind,
  };
}

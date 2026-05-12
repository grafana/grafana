import { GENERAL_FOLDER_UID, TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { type DashboardViewItem, type DashboardViewItemKind } from 'app/features/search/types';
import { createAsyncThunk } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { listDashboards, listFolders, listTeamFolders } from '../api/services';
import { type DashboardViewItemWithUIItems, type UIDashboardViewItem } from '../types';
import { addTeamFolderPrefix, removeTeamFolderPrefix } from '../utils/dashboards';

import { findItem } from './utils';

async function listTeamFoldersSafe() {
  try {
    return await listTeamFolders();
  } catch (error) {
    console.error('Failed to load team folders', error);
    return [];
  }
}

interface FetchNextChildrenPageArgs {
  parentUID: string | undefined;

  // Allow UI items to be excluded (they're always excluded) for convenience for callers
  excludeKinds?: Array<DashboardViewItemWithUIItems['kind'] | UIDashboardViewItem['uiKind']>;
  pageSize: number;
}

interface FetchNextChildrenPageResult {
  children: DashboardViewItem[];
  kind: 'folder' | 'dashboard';
  page: number;
  lastPageOfKind: boolean;
}

interface RefetchChildrenArgs {
  parentUID: string | undefined;
  pageSize: number;
}

interface RefetchChildrenResult {
  children: DashboardViewItem[];
  kind: 'folder' | 'dashboard';
  page: number;
  lastPageOfKind: boolean;
}

export const refreshParents = createAsyncThunk(
  'browseDashboards/refreshParents',
  async (uids: string[], { getState, dispatch }) => {
    const { browseDashboards } = getState();
    const { rootItems, childrenByParentUID } = browseDashboards;
    const parentsToRefresh = new Set<string | undefined>();

    for (const uid of uids) {
      // find the parent folder uid
      const item = findItem(rootItems?.items ?? [], childrenByParentUID, uid);
      parentsToRefresh.add(item?.parentUID);
    }

    for (const parentUID of parentsToRefresh) {
      dispatch(refetchChildren({ parentUID, pageSize: PAGE_SIZE }));
    }
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
  async ({ parentUID, pageSize }: RefetchChildrenArgs): Promise<RefetchChildrenResult> => {
    if (parentUID === TEAM_FOLDERS_UID) {
      const children = await listTeamFoldersSafe();
      return { children, kind: 'dashboard', page: 1, lastPageOfKind: true };
    }

    const strippedUID = parentUID ? removeTeamFolderPrefix(parentUID) : parentUID;
    const uid = strippedUID === GENERAL_FOLDER_UID ? undefined : strippedUID;

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

    // Propagate prefix to all descendants so they get independent expand/collapse state
    const isTeamFolderChild = parentUID !== strippedUID;
    if (isTeamFolderChild) {
      children = children.map((child) => ({
        ...child,
        uid: addTeamFolderPrefix(removeTeamFolderPrefix(child.uid)),
      }));
    }

    return {
      children,
      lastPageOfKind: lastPageOfKind,
      page,
      kind: fetchKind,
    };
  }
);

export const fetchNextChildrenPage = createAsyncThunk(
  'browseDashboards/fetchNextChildrenPage',
  async (
    { parentUID, excludeKinds = [], pageSize }: FetchNextChildrenPageArgs,
    thunkAPI
  ): Promise<undefined | FetchNextChildrenPageResult> => {
    if (parentUID === TEAM_FOLDERS_UID) {
      const state = thunkAPI.getState().browseDashboards;
      const collection = state.childrenByParentUID[parentUID];
      if (collection?.isFullyLoaded) {
        return undefined;
      }
      const children = await listTeamFoldersSafe();
      return { children, kind: 'dashboard', page: 1, lastPageOfKind: true };
    }

    // TODO: invert prop to `includeKinds`, but also support not loading folders
    const loadDashboards = !excludeKinds.includes('dashboard');

    const strippedUID = parentUID ? removeTeamFolderPrefix(parentUID) : parentUID;
    const uid = strippedUID === GENERAL_FOLDER_UID ? undefined : strippedUID;

    const state = thunkAPI.getState().browseDashboards;
    const collectionKey = parentUID === GENERAL_FOLDER_UID ? undefined : parentUID;
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
      // There's nothing to load at all
      console.warn(`fetchNextChildrenPage called for ${uid} but that collection is fully loaded`);
      // return;
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
      return;
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

    // Propagate prefix to all descendants so they get independent expand/collapse state
    const isTeamFolderChild = parentUID !== strippedUID;
    if (isTeamFolderChild) {
      children = children.map((child) => ({
        ...child,
        uid: addTeamFolderPrefix(removeTeamFolderPrefix(child.uid)),
      }));
    }

    return {
      children,
      lastPageOfKind,
      page,
      kind: fetchKind,
    };
  }
);

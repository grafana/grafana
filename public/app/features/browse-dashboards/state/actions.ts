import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';
import { createAsyncThunk } from 'app/types/store';

import { listDashboards, listFolders, PAGE_SIZE } from '../api/services';
import { DashboardViewItemWithUIItems, UIDashboardViewItem } from '../types';

import { findItem } from './utils';

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

export const refetchChildren = createAsyncThunk(
  'browseDashboards/refetchChildren',
  async ({ parentUID, pageSize }: RefetchChildrenArgs): Promise<RefetchChildrenResult> => {
    const uid = parentUID === GENERAL_FOLDER_UID ? undefined : parentUID;

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
    // TODO: invert prop to `includeKinds`, but also support not loading folders
    const loadDashboards = !excludeKinds.includes('dashboard');

    const uid = parentUID === GENERAL_FOLDER_UID ? undefined : parentUID;

    const state = thunkAPI.getState().browseDashboards;
    const collection = uid ? state.childrenByParentUID[uid] : state.rootItems;

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

    return {
      children,
      lastPageOfKind,
      page,
      kind: fetchKind,
    };
  }
);

import { getBackendSrv } from '@grafana/runtime';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';
import { createAsyncThunk, DashboardDTO } from 'app/types';

import { listDashboards, listFolders } from '../api/services';

interface FetchChildrenPayload {
  parentUID: string | undefined;
  pageSize: number;
}

interface FetchChildrenFulfilledPayload {
  children: DashboardViewItem[];
  kind: 'folder' | 'dashboard';
  page: number;
  lastPageOfKind: boolean;
}

export const fetchChildren = createAsyncThunk(
  'browseDashboards/fetchChildren',
  async (
    { parentUID, pageSize }: FetchChildrenPayload,
    thunkAPI
  ): Promise<undefined | FetchChildrenFulfilledPayload> => {
    if (process.env.NODE_ENV !== 'production' && parentUID === GENERAL_FOLDER_UID) {
      console.error(new Error("fetchChildren called with a parentUID of 'general' instead of undefined"));
    }

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
      console.warn(`FetchedChildren called for ${uid} but that collection is fully loaded`);
      // return;
    } else if (collection.lastFetchedKind === 'folder' && collection.lastKindHasMoreItems) {
      // Load additional pages of folders
      page = collection.lastFetchedPage + 1;
      fetchKind = 'folder';
    } else {
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

export const deleteDashboard = createAsyncThunk('browseDashboards/deleteDashboard', async (dashboardUID: string) => {
  return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${dashboardUID}`);
});

export const deleteFolder = createAsyncThunk('browseDashboards/deleteFolder', async (folderUID: string) => {
  return getBackendSrv().delete(`/api/folders/${folderUID}`, undefined, {
    // TODO: Revisit this field when this permissions issue is resolved
    // https://github.com/grafana/grafana-enterprise/issues/5144
    params: { forceDeleteRules: false },
  });
});

export const moveDashboard = createAsyncThunk(
  'browseDashboards/moveDashboard',
  async ({ dashboardUID, destinationUID }: { dashboardUID: string; destinationUID: string }) => {
    const fullDash: DashboardDTO = await getBackendSrv().get(`/api/dashboards/uid/${dashboardUID}`);

    const options = {
      dashboard: fullDash.dashboard,
      folderUid: destinationUID,
      overwrite: false,
    };

    return getBackendSrv().post('/api/dashboards/db', {
      message: '',
      ...options,
    });
  }
);

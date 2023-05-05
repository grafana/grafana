import { getBackendSrv } from '@grafana/runtime';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { createAsyncThunk, DashboardDTO } from 'app/types';

import { listDashboards, listFolders, PAGE_SIZE } from '../api/services';

export const fetchChildren = createAsyncThunk(
  'browseDashboards/fetchChildren',
  async (parentUID: string | undefined, thunkAPI) => {
    // Need to handle the case where the parentUID is the root
    const uid = parentUID === GENERAL_FOLDER_UID ? undefined : parentUID;

    if (process.env.NODE_ENV !== 'production' && parentUID === GENERAL_FOLDER_UID) {
      const err = new Error("fetchChildren called with a parentUID of 'general' instead of undefined");
      console.error(err);
    }

    const state = thunkAPI.getState().browseDashboards;
    const collection = uid ? state.childrenByParentUID[uid] : state.rootItems;

    if (!collection) {
      // no previous data for this uid, so get folders first
      const page = 1;
      return {
        children: await listFolders(uid, undefined, page),
        page,
      };
    }

    if (collection.lastFetched === 'folder' && collection.lastFetchedSize >= PAGE_SIZE) {
      const page = collection.lastFetchedPage + 1;
      return {
        children: await listFolders(uid, undefined, page),
        page,
      };
    } else {
      const page = 1;
      return {
        children: await listDashboards(uid, page),
        page,
      };
    }

    // return await getFolderChildren(uid, undefined, true);
  }
);

export const deleteDashboard = createAsyncThunk('browseDashboards/deleteDashboard', async (dashboardUID: string) => {
  return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${dashboardUID}`);
});

export const deleteFolder = createAsyncThunk('browseDashboards/deleteFolder', async (folderUID: string) => {
  return getBackendSrv().delete(`/api/folders/${folderUID}`, undefined, {
    // TODO: Once backend returns alert rule counts, set this back to true
    // when this is merged https://github.com/grafana/grafana/pull/67259
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

export const moveFolder = createAsyncThunk(
  'browseDashboards/moveFolder',
  async ({ folderUID, destinationUID }: { folderUID: string; destinationUID: string }) => {
    return getBackendSrv().post(`/api/folders/${folderUID}/move`, { parentUID: destinationUID });
  }
);

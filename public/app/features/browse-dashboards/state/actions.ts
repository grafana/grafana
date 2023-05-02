import { getBackendSrv } from '@grafana/runtime';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getFolderChildren } from 'app/features/search/service/folders';
import { createAsyncThunk, DashboardDTO } from 'app/types';

export const fetchChildren = createAsyncThunk(
  'browseDashboards/fetchChildren',
  async (parentUID: string | undefined) => {
    // Need to handle the case where the parentUID is the root
    const uid = parentUID === GENERAL_FOLDER_UID ? undefined : parentUID;
    return await getFolderChildren(uid, undefined, true);
  }
);

export const deleteDashboard = createAsyncThunk('browseDashboards/deleteDashboard', async (dashboardUID: string) => {
  return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${dashboardUID}`);
});

export const deleteFolder = createAsyncThunk('browseDashboards/deleteFolder', async (folderUID: string) => {
  return getBackendSrv().delete(`/api/folders/${folderUID}`, undefined, {
    params: { forceDeleteRules: true },
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

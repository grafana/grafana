import { createAsyncThunk } from '@reduxjs/toolkit';

import { getBackendSrv } from '@grafana/runtime';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardDTO } from 'app/types';

export const fetchChildren = createAsyncThunk(
  'browseDashboards/fetchChildren',
  async (parentUID: string | undefined) => {
    return await getFolderChildren(parentUID, undefined, true);
  }
);

export const deleteDashboard = createAsyncThunk('browseDashboards/deleteDashboard', async (dashboardUID: string) => {
  return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${dashboardUID}`);
});

export const deleteFolder = createAsyncThunk('browseDashboards/deleteFolder', async (folderUID: string) => {
  return getBackendSrv().delete(`/api/folders/${folderUID}`, undefined, { params: { forceDeleteRules: true } });
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

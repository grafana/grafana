import { getBackendSrv } from '@grafana/runtime';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { getFolderChildren } from 'app/features/search/service/folders';
import { createAsyncThunk, DashboardDTO } from 'app/types';

import { rootItemsSelector, childrenByParentUIDSelector } from './hooks';
import { findItem } from './utils';

export const fetchChildren = createAsyncThunk(
  'browseDashboards/fetchChildren',
  async (parentUID: string | undefined) => {
    return await getFolderChildren(parentUID, undefined, true);
  }
);

export const deleteDashboard = createAsyncThunk(
  'browseDashboards/deleteDashboard',
  async (dashboardUID: string, thunkApi) => {
    const result = await getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${dashboardUID}`);
    const state = thunkApi.getState();

    // refetch the parent folder children to update the tree
    const dashboard = findItem(rootItemsSelector(state), childrenByParentUIDSelector(state), dashboardUID);
    thunkApi.dispatch(fetchChildren(dashboard?.parentUID));

    return result;
  }
);

export const deleteFolder = createAsyncThunk('browseDashboards/deleteFolder', async (folderUID: string, thunkApi) => {
  const result = await getBackendSrv().delete(`/api/folders/${folderUID}`, undefined, {
    params: { forceDeleteRules: true },
  });
  const state = thunkApi.getState();

  // refetch the parent and destination folder children to update the tree
  const folder = findItem(rootItemsSelector(state), childrenByParentUIDSelector(state), folderUID);
  thunkApi.dispatch(fetchChildren(folder?.parentUID));

  return result;
});

export const moveDashboard = createAsyncThunk(
  'browseDashboards/moveDashboard',
  async ({ dashboardUID, destinationUID }: { dashboardUID: string; destinationUID: string }, thunkApi) => {
    const fullDash: DashboardDTO = await getBackendSrv().get(`/api/dashboards/uid/${dashboardUID}`);
    const state = thunkApi.getState();

    const options = {
      dashboard: fullDash.dashboard,
      folderUid: destinationUID,
      overwrite: false,
    };

    const result = await getBackendSrv().post('/api/dashboards/db', {
      message: '',
      ...options,
    });

    // refetch the parent and destination folder children to update the tree
    const dashboard = findItem(rootItemsSelector(state), childrenByParentUIDSelector(state), dashboardUID);
    thunkApi.dispatch(fetchChildren(dashboard?.parentUID));
    thunkApi.dispatch(fetchChildren(destinationUID));

    return result;
  }
);

export const moveFolder = createAsyncThunk(
  'browseDashboards/moveFolder',
  async ({ folderUID, destinationUID }: { folderUID: string; destinationUID: string }, thunkApi) => {
    const result = await getBackendSrv().post(`/api/folders/${folderUID}/move`, { parentUID: destinationUID });
    const state = thunkApi.getState();

    // refetch the parent and destination folder children to update the tree
    const folder = findItem(rootItemsSelector(state), childrenByParentUIDSelector(state), folderUID);
    thunkApi.dispatch(fetchChildren(folder?.parentUID));
    thunkApi.dispatch(fetchChildren(destinationUID));

    return result;
  }
);

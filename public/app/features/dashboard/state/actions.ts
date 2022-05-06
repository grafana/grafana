import { TimeZone } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { loadPluginDashboards } from 'app/features/plugins/admin/state/actions';
import { updateTimeZoneForSession, updateWeekStartForSession } from 'app/features/profile/state/reducers';
import {
  createAsyncThunk,
  DashboardAcl,
  DashboardAclDTO,
  DashboardAclUpdateDTO,
  NewDashboardAclItem,
  PermissionLevel,
} from 'app/types';

import { cancelVariables } from '../../variables/state/actions';
import { getTimeSrv } from '../services/TimeSrv';

function toUpdateItem(item: DashboardAcl): DashboardAclUpdateDTO {
  return {
    userId: item.userId,
    teamId: item.teamId,
    role: item.role,
    permission: item.permission,
  };
}

export const fetchDashboardPermissions = createAsyncThunk(
  'dashboards/fetchDashboardPermissions',
  async (key: string, { getState }) => {
    const dashboardState = getState().dashboards;
    if (!(key in dashboardState)) {
      throw new Error(`Unable to find dashboard with key "${key}"`);
    }

    const dashModel = dashboardState.byKey[key].getModel();
    if (!dashModel) {
      throw new Error(`Dashboard state entry with key "${key}" has empty model`);
    }

    const dashId = dashModel.id;
    const dashboardAclDTOs: DashboardAclDTO[] = await getBackendSrv().get(`/api/dashboards/id/${dashId}/permissions`);
    return { key, dashboardAclDTOs };
  }
);

interface UpdateDashboardPermissionArgs {
  key: string;
  itemToUpdate: DashboardAcl;
  level: PermissionLevel;
}

export const updateDashboardPermission = createAsyncThunk(
  'dashboards/updateDashboardPermission',
  async ({ key, itemToUpdate, level }: UpdateDashboardPermissionArgs, { dispatch, getState }) => {
    const dashboardState = getState().dashboards;
    if (!(key in dashboardState)) {
      throw new Error(`Unable to find dashboard with key "${key}"`);
    }

    const dashboard = dashboardState.byKey[key];
    const dashboardModel = dashboard.getModel();
    if (!dashboardModel) {
      throw new Error(`Dashboard state entry with key "${key}" has empty model`);
    }

    const itemsToUpdate = [];
    for (const item of dashboard.permissions) {
      if (item.inherited) {
        continue;
      }

      const updated = toUpdateItem(item);

      // if this is the item we want to update, update its permission
      if (itemToUpdate === item) {
        updated.permission = level;
      }

      itemsToUpdate.push(updated);
    }

    await getBackendSrv().post(`/api/dashboards/id/${dashboardModel.id}/permissions`, { items: itemsToUpdate });
    await dispatch(fetchDashboardPermissions(key));
  }
);

export const removeDashboardPermission = createAsyncThunk(
  'dashboards/removeDashboardPermission',
  async ({ key, itemToDelete }: { key: string; itemToDelete: DashboardAcl }, { dispatch, getState }) => {
    const dashboardState = getState().dashboards;
    if (!(key in dashboardState)) {
      throw new Error(`Unable to find dashboard with key "${key}"`);
    }

    const dashboard = getState().dashboards.byKey[key];
    const dashboardModel = dashboard.getModel();
    if (!dashboardModel) {
      throw new Error(`Dashboard state entry with key "${key}" has empty model`);
    }
    const itemsToUpdate = [];

    for (const item of dashboard.permissions) {
      if (item.inherited || item === itemToDelete) {
        continue;
      }
      itemsToUpdate.push(toUpdateItem(item));
    }

    await getBackendSrv().post(`/api/dashboards/id/${dashboardModel.id}/permissions`, { items: itemsToUpdate });
    await dispatch(fetchDashboardPermissions(key));
  }
);

export const addDashboardPermission = createAsyncThunk(
  'dashboards/addDashboardPermission',
  async ({ key, newItem }: { key: string; newItem: NewDashboardAclItem }, { dispatch, getState }) => {
    const dashboardState = getState().dashboards;
    if (!(key in dashboardState)) {
      throw new Error(`Unable to find dashboard with key "${key}"`);
    }

    const dashboard = dashboardState.byKey[key];
    const dashboardModel = dashboard.getModel();
    if (!dashboardModel) {
      throw new Error(`Dashboard state entry with key "${key}" has empty model`);
    }
    const itemsToUpdate = [];

    for (const item of dashboard.permissions) {
      if (item.inherited) {
        continue;
      }
      itemsToUpdate.push(toUpdateItem(item));
    }

    itemsToUpdate.push({
      userId: newItem.userId,
      teamId: newItem.teamId,
      role: newItem.role,
      permission: newItem.permission,
    });

    await getBackendSrv().post(`/api/dashboards/id/${dashboardModel.id}/permissions`, { items: itemsToUpdate });
    await dispatch(fetchDashboardPermissions(key));
  }
);

export const importDashboard = createAsyncThunk(
  'dashboards/importDashboard',
  async ({ data, dashboardTitle }: { data: any; dashboardTitle: string }, { dispatch }) => {
    await getBackendSrv().post('/api/dashboards/import', data);
    dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboardTitle)));
    dispatch(loadPluginDashboards());
  }
);

export const removeDashboard = createAsyncThunk('dashboards/removeDashboard', async (uid: string, { dispatch }) => {
  await getBackendSrv().delete(`/api/dashboards/uid/${uid}`);
  dispatch(loadPluginDashboards());
});

export const cleanUpDashboardAndVariables = createAsyncThunk(
  'dashboards/cleanUpDashboardAndVariables',
  (key: string, { dispatch, getState }) => {
    const dashboardState = getState().dashboards;
    if (!(key in dashboardState)) {
      throw new Error(`Unable to find dashboard with key "${key}"`);
    }

    const dashboard = dashboardState.byKey[key].getModel();

    if (dashboard) {
      dashboard.destroy();
      dispatch(cancelVariables(dashboard.uid));
    }

    getTimeSrv().stopAutoRefresh();
    return { key };
  }
);

export const updateTimeZoneDashboard = createAsyncThunk(
  'dashboards/updateTimeZoneDashboard',
  async (timeZone: TimeZone, { dispatch }) => {
    await dispatch(updateTimeZoneForSession(timeZone));
    getTimeSrv().refreshTimeModel();
  }
);

export const updateWeekStartDashboard = createAsyncThunk(
  'dashboards/updateWeekStartDashboard',
  async (weekStart: string, { dispatch }) => {
    await dispatch(updateWeekStartForSession(weekStart));
    getTimeSrv().refreshTimeModel();
  }
);

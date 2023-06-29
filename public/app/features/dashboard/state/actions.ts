import { TimeZone } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { removeAllPanels } from 'app/features/panel/state/reducers';
import { updateTimeZoneForSession, updateWeekStartForSession } from 'app/features/profile/state/reducers';
import { DashboardAcl, DashboardAclUpdateDTO, NewDashboardAclItem, PermissionLevel, ThunkResult } from 'app/types';

import { loadPluginDashboards } from '../../plugins/admin/state/actions';
import { cancelVariables } from '../../variables/state/actions';
import { getDashboardSrv } from '../services/DashboardSrv';
import { getTimeSrv } from '../services/TimeSrv';

import { cleanUpDashboard, loadDashboardPermissions } from './reducers';

export function getDashboardPermissions(id: number): ThunkResult<void> {
  return async (dispatch) => {
    const permissions = await getBackendSrv().get(`/api/dashboards/id/${id}/permissions`);
    dispatch(loadDashboardPermissions(permissions));
  };
}

function toUpdateItem(item: DashboardAcl): DashboardAclUpdateDTO {
  return {
    userId: item.userId,
    teamId: item.teamId,
    role: item.role,
    permission: item.permission,
  };
}

export function updateDashboardPermission(
  dashboardId: number,
  itemToUpdate: DashboardAcl,
  level: PermissionLevel
): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const { dashboard } = getStore();
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

    await getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
    await dispatch(getDashboardPermissions(dashboardId));
  };
}

export function removeDashboardPermission(dashboardId: number, itemToDelete: DashboardAcl): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const dashboard = getStore().dashboard;
    const itemsToUpdate = [];

    for (const item of dashboard.permissions) {
      if (item.inherited || item === itemToDelete) {
        continue;
      }
      itemsToUpdate.push(toUpdateItem(item));
    }

    await getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
    await dispatch(getDashboardPermissions(dashboardId));
  };
}

export function addDashboardPermission(dashboardId: number, newItem: NewDashboardAclItem): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const { dashboard } = getStore();
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

    await getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
    await dispatch(getDashboardPermissions(dashboardId));
  };
}

export function importDashboard(data: any, dashboardTitle: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post('/api/dashboards/import', data);
    dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboardTitle)));
    dispatch(loadPluginDashboards());
  };
}

export function removeDashboard(uid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/dashboards/uid/${uid}`);
    dispatch(loadPluginDashboards());
  };
}

export const cleanUpDashboardAndVariables = (): ThunkResult<void> => (dispatch, getStore) => {
  const store = getStore();
  const dashboard = store.dashboard.getModel();

  if (dashboard) {
    dashboard.destroy();
    dispatch(cancelVariables(dashboard.uid));
  }

  getTimeSrv().stopAutoRefresh();
  dispatch(cleanUpDashboard());
  dispatch(removeAllPanels());

  dashboardWatcher.leave();

  getDashboardSrv().setCurrent(undefined);
};

export const updateTimeZoneDashboard =
  (timeZone: TimeZone): ThunkResult<void> =>
  (dispatch) => {
    dispatch(updateTimeZoneForSession(timeZone));
    getTimeSrv().refreshTimeModel();
  };

export const updateWeekStartDashboard =
  (weekStart: string): ThunkResult<void> =>
  (dispatch) => {
    dispatch(updateWeekStartForSession(weekStart));
    getTimeSrv().refreshTimeModel();
  };

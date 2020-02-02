// Services & Utils
import { createAction } from '@reduxjs/toolkit';
import { getBackendSrv } from '@grafana/runtime';
import { createSuccessNotification } from 'app/core/copy/appNotification';
// Actions
import { loadPluginDashboards } from '../../plugins/state/actions';
import { notifyApp } from 'app/core/actions';
// Types
import {
  DashboardAcl,
  DashboardAclDTO,
  DashboardAclUpdateDTO,
  DashboardInitError,
  MutableDashboard,
  NewDashboardAclItem,
  PermissionLevel,
  ThunkResult,
} from 'app/types';
import { DataQuery } from '@grafana/data';

export const loadDashboardPermissions = createAction<DashboardAclDTO[]>('dashboard/loadDashboardPermissions');

export const dashboardInitFetching = createAction('dashboard/dashboardInitFetching');

export const dashboardInitServices = createAction('dashboard/dashboardInitServices');

export const dashboardInitSlow = createAction('dashboard/dashboardInitSlow');

export const dashboardInitCompleted = createAction<MutableDashboard>('dashboard/dashboardInitCompleted');

/*
 * Unrecoverable init failure (fetch or model creation failed)
 */
export const dashboardInitFailed = createAction<DashboardInitError>('dashboard/dashboardInitFailed');

/*
 * When leaving dashboard, resets state
 * */
export const cleanUpDashboard = createAction('dashboard/cleanUpDashboard');

export function getDashboardPermissions(id: number): ThunkResult<void> {
  return async dispatch => {
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

interface SetDashboardQueriesToUpdatePayload {
  panelId: number;
  queries: DataQuery[];
}

export const clearDashboardQueriesToUpdate = createAction('dashboard/clearDashboardQueriesToUpdate');
export const setDashboardQueriesToUpdate = createAction<SetDashboardQueriesToUpdatePayload>(
  'dashboard/setDashboardQueriesToUpdate'
);
export const setDashboardQueriesToUpdateOnLoad = (panelId: number, queries: DataQuery[]): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(setDashboardQueriesToUpdate({ panelId, queries }));
  };
};

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

      // if this is the item we want to update, update it's permission
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
  return async dispatch => {
    await getBackendSrv().post('/api/dashboards/import', data);
    dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboardTitle)));
    dispatch(loadPluginDashboards());
  };
}

export function removeDashboard(uri: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/dashboards/${uri}`);
    dispatch(loadPluginDashboards());
  };
}

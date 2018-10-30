import { StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from 'app/core/services/backend_srv';
import appEvents from 'app/core/app_events';
import { loadPluginDashboards } from '../../plugins/state/actions';
import {
  DashboardAcl,
  DashboardAclDTO,
  PermissionLevel,
  DashboardAclUpdateDTO,
  NewDashboardAclItem,
} from 'app/types/acl';

export enum ActionTypes {
  LoadDashboardPermissions = 'LOAD_DASHBOARD_PERMISSIONS',
}

export interface LoadDashboardPermissionsAction {
  type: ActionTypes.LoadDashboardPermissions;
  payload: DashboardAcl[];
}

export type Action = LoadDashboardPermissionsAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export const loadDashboardPermissions = (items: DashboardAclDTO[]): LoadDashboardPermissionsAction => ({
  type: ActionTypes.LoadDashboardPermissions,
  payload: items,
});

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

      // if this is the item we want to update, update it's permisssion
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

export function importDashboard(data, dashboardTitle: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post('/api/dashboards/import', data);
    appEvents.emit('alert-success', ['Dashboard Imported', dashboardTitle]);
    dispatch(loadPluginDashboards());
  };
}

export function removeDashboard(uri: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/dashboards/${uri}`);
    dispatch(loadPluginDashboards());
  };
}

// Services & Utils
import { getBackendSrv } from '@grafana/runtime';
import { createSuccessNotification } from 'app/core/copy/appNotification';
// Actions
import { loadPluginDashboards } from '../../plugins/state/actions';
import {
  dashboardCollection,
  loadDashboardPermissions,
  panelModelAndPluginReady,
  setPanelAngularComponent,
} from './reducers';
import { notifyApp } from 'app/core/actions';
import { loadPanelPlugin } from 'app/features/plugins/state/actions';
// Types
import { DashboardAcl, DashboardAclUpdateDTO, NewDashboardAclItem, PermissionLevel, ThunkResult } from 'app/types';
import { PanelModel } from './PanelModel';
import { toCollectionAction } from '../../../core/reducers/createCollection';

export function getDashboardPermissions(id: number, uid: string): ThunkResult<void> {
  return async dispatch => {
    const permissions = await getBackendSrv().get(`/api/dashboards/id/${id}/permissions`);
    dispatch(toCollectionAction(loadDashboardPermissions(permissions), uid));
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
  dashboardUId: string,
  itemToUpdate: DashboardAcl,
  level: PermissionLevel
): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const dashboard = dashboardCollection.selector(getStore(), dashboardUId);
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
    await dispatch(getDashboardPermissions(dashboardId, dashboardUId));
  };
}

export function removeDashboardPermission(
  dashboardId: number,
  dashboardUId: string,
  itemToDelete: DashboardAcl
): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const dashboard = dashboardCollection.selector(getStore(), dashboardUId);
    const itemsToUpdate = [];

    for (const item of dashboard.permissions) {
      if (item.inherited || item === itemToDelete) {
        continue;
      }
      itemsToUpdate.push(toUpdateItem(item));
    }

    await getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
    await dispatch(getDashboardPermissions(dashboardId, dashboardUId));
  };
}

export function addDashboardPermission(
  dashboardId: number,
  dashboardUId: string,
  newItem: NewDashboardAclItem
): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const dashboard = dashboardCollection.selector(getStore(), dashboardUId);
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
    await dispatch(getDashboardPermissions(dashboardId, dashboardUId));
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

export function initDashboardPanel(dashboardUid: string, panel: PanelModel): ThunkResult<void> {
  return async (dispatch, getStore) => {
    let plugin = getStore().plugins.panels[panel.type];

    if (!plugin) {
      plugin = await dispatch(loadPanelPlugin(panel.type));
    }

    if (!panel.plugin) {
      panel.pluginLoaded(plugin);
    }

    dispatch(toCollectionAction(panelModelAndPluginReady({ panelId: panel.id, plugin }), dashboardUid));
  };
}

export function changePanelPlugin(dashboardUId: string, panel: PanelModel, pluginId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    // ignore action is no change
    if (panel.type === pluginId) {
      return;
    }

    const store = getStore();
    let plugin = store.plugins.panels[pluginId];

    if (!plugin) {
      plugin = await dispatch(loadPanelPlugin(pluginId));
    }

    // clean up angular component (scope / ctrl state)
    const angularComponent = dashboardCollection.selector(store, dashboardUId).panels[panel.id].angularComponent;
    if (angularComponent) {
      angularComponent.destroy();
      dispatch(
        toCollectionAction(setPanelAngularComponent({ panelId: panel.id, angularComponent: null }), dashboardUId)
      );
    }

    panel.changePlugin(plugin);

    dispatch(toCollectionAction(panelModelAndPluginReady({ panelId: panel.id, plugin }), dashboardUId));
  };
}

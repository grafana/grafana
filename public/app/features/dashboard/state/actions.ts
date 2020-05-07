// Services & Utils
import { getBackendSrv } from '@grafana/runtime';
import { createSuccessNotification } from 'app/core/copy/appNotification';
// Actions
import { loadPluginDashboards } from '../../plugins/state/actions';
import {
  cleanUpDashboard,
  dashboardCollection,
  loadDashboardPermissions,
  panelModelAndPluginReady,
  setPanelAngularComponent,
  SetPanelAngularComponentPayload,
} from './reducers';
import { notifyApp } from 'app/core/actions';
import { loadPanelPlugin } from 'app/features/plugins/state/actions';
// Types
import {
  DashboardAcl,
  DashboardAclUpdateDTO,
  DashboardInitPhase,
  NewDashboardAclItem,
  PermissionLevel,
  ThunkResult,
} from 'app/types';
import { PanelModel } from './PanelModel';
import { toCollectionAction } from '../../../core/reducers/createCollection';
import { cleanUpVariables } from '../../variables/state/variablesReducer';
import { clearVariablesDashboardUid } from 'app/features/variables/state/dashboardIdReducer';
import { getDashboardUid } from '../utils/getDashboardUid';

export function getDashboardPermissions(id: number): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const permissions = await getBackendSrv().get(`/api/dashboards/id/${id}/permissions`);
    const dashboardUid = getDashboardUid(getStore());
    dispatch(toCollectionAction(loadDashboardPermissions(permissions), dashboardUid));
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
    const dashboardUid = getDashboardUid(getStore());
    const dashboard = dashboardCollection.selector(getStore(), dashboardUid);
    if (!dashboard.permissions) {
      return;
    }

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
    const dashboardUid = getDashboardUid(getStore());
    const dashboard = dashboardCollection.selector(getStore(), dashboardUid);
    if (!dashboard.permissions) {
      return;
    }

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
    const dashboardUid = getDashboardUid(getStore());
    const dashboard = dashboardCollection.selector(getStore(), dashboardUid);
    if (!dashboard.permissions) {
      return;
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

export function initDashboardPanel(panel: PanelModel): ThunkResult<void> {
  return async (dispatch, getStore) => {
    let plugin = getStore().plugins.panels[panel.type];

    if (!plugin) {
      plugin = await dispatch(loadPanelPlugin(panel.type));
    }

    if (!panel.plugin) {
      panel.pluginLoaded(plugin);
    }

    const dashboardUid = getDashboardUid(getStore());
    dispatch(toCollectionAction(panelModelAndPluginReady({ panelId: panel.id, plugin }), dashboardUid));
  };
}

export function changePanelPlugin(panel: PanelModel, pluginId: string): ThunkResult<void> {
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
    const dashboardUid = getDashboardUid(store);
    const angularComponent = dashboardCollection.selector(store, dashboardUid).panels[panel.id].angularComponent;
    if (angularComponent) {
      angularComponent.destroy();
      dispatch(
        toCollectionAction(setPanelAngularComponent({ panelId: panel.id, angularComponent: null }), dashboardUid)
      );
    }

    panel.changePlugin(plugin);

    dispatch(toCollectionAction(panelModelAndPluginReady({ panelId: panel.id, plugin }), dashboardUid));
  };
}

export const setAngularPanelComponent = (payload: SetPanelAngularComponentPayload): ThunkResult<void> => (
  dispatch,
  getState
) => {
  const dashboardUid = getDashboardUid(getState());
  dispatch(toCollectionAction(setPanelAngularComponent(payload), dashboardUid));
};

export const cleanUpUnCleanedDashboardStates = (currentDashboardId: string): ThunkResult<void> => (
  dispatch,
  getState
) => {
  const dashboardUIds = Object.keys(getState().dashboards);
  for (const uid of dashboardUIds) {
    if (uid === currentDashboardId) {
      continue;
    }

    const dashboardState = dashboardCollection.selector(getState(), uid);
    if (dashboardState.initPhase !== DashboardInitPhase.Completed) {
      continue;
    }

    console.log('Cleaning up dashboard', uid);
    dispatch(cleanUpVariables());
    dispatch(clearVariablesDashboardUid());
    dispatch(toCollectionAction(cleanUpDashboard(), uid));
  }
};

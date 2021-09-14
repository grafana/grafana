import { getBackendSrv } from '@grafana/runtime';
import { PanelPlugin } from '@grafana/data';
import { ThunkResult } from 'app/types';
import { config } from 'app/core/config';
import { importPanelPlugin } from 'app/features/plugins/plugin_loader';
import {
  loadPanelPlugin as loadPanelPluginNew,
  loadPluginDashboards as loadPluginDashboardsNew,
} from '../admin/state/actions';
import {
  pluginDashboardsLoad,
  pluginDashboardsLoaded,
  pluginsLoaded,
  panelPluginLoaded,
  pluginsErrorsLoaded,
} from './reducers';

export function loadPlugins(): ThunkResult<void> {
  return async (dispatch) => {
    const plugins = await getBackendSrv().get('api/plugins', { embedded: 0 });
    dispatch(pluginsLoaded(plugins));
  };
}

export function loadPluginsErrors(): ThunkResult<void> {
  return async (dispatch) => {
    const errors = await getBackendSrv().get('api/plugins/errors');
    dispatch(pluginsErrorsLoaded(errors));
  };
}

function loadPluginDashboardsOriginal(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    dispatch(pluginDashboardsLoad());
    const dataSourceType = getStore().dataSources.dataSource.type;
    const response = await getBackendSrv().get(`api/plugins/${dataSourceType}/dashboards`);
    dispatch(pluginDashboardsLoaded(response));
  };
}

function loadPanelPluginOriginal(pluginId: string): ThunkResult<Promise<PanelPlugin>> {
  return async (dispatch, getStore) => {
    let plugin = getStore().plugins.panels[pluginId];

    if (!plugin) {
      plugin = await importPanelPlugin(pluginId);

      // second check to protect against raise condition
      if (!getStore().plugins.panels[pluginId]) {
        dispatch(panelPluginLoaded(plugin));
      }
    }

    return plugin;
  };
}

export const loadPluginDashboards = config.pluginAdminEnabled ? loadPluginDashboardsNew : loadPluginDashboardsOriginal;
export const loadPanelPlugin = config.pluginAdminEnabled ? loadPanelPluginNew : loadPanelPluginOriginal;

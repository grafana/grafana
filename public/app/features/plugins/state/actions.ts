import { getBackendSrv } from '@grafana/runtime';

import { ThunkResult } from 'app/types';
import { pluginDashboardsLoad, pluginDashboardsLoaded, pluginsLoaded } from './reducers';

export function loadPlugins(): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().get('api/plugins', { embedded: 0 });
    dispatch(pluginsLoaded(result));
  };
}

export function loadPluginDashboards(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    dispatch(pluginDashboardsLoad());
    const dataSourceType = getStore().dataSources.dataSource.type;
    const response = await getBackendSrv().get(`api/plugins/${dataSourceType}/dashboards`);
    dispatch(pluginDashboardsLoaded(response));
  };
}

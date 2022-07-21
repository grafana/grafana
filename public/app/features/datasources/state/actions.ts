import { DataSourcePluginMeta, DataSourceSettings, locationUtil } from '@grafana/data';
import {
  DataSourceWithBackend,
  getDataSourceSrv,
  HealthCheckError,
  HealthCheckResultDetails,
  isFetchError,
  locationService,
} from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { contextSrv } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';
import { importDataSourcePlugin } from 'app/features/plugins/plugin_loader';
import { DataSourcePluginCategory, ThunkDispatch, ThunkResult } from 'app/types';

import * as api from '../api';
import { nameExits, findNewName } from '../utils';

import { buildCategories } from './buildCategories';
import { buildNavModel } from './navModel';
import {
  dataSourceLoaded,
  dataSourceMetaLoaded,
  dataSourcePluginsLoad,
  dataSourcePluginsLoaded,
  dataSourcesLoaded,
  initDataSourceSettingsFailed,
  initDataSourceSettingsSucceeded,
  testDataSourceFailed,
  testDataSourceStarting,
  testDataSourceSucceeded,
} from './reducers';
import { getDataSource, getDataSourceMeta } from './selectors';

export interface DataSourceTypesLoadedPayload {
  plugins: DataSourcePluginMeta[];
  categories: DataSourcePluginCategory[];
}

export interface InitDataSourceSettingDependencies {
  loadDataSource: typeof loadDataSource;
  loadDataSourceMeta: typeof loadDataSourceMeta;
  getDataSource: typeof getDataSource;
  getDataSourceMeta: typeof getDataSourceMeta;
  importDataSourcePlugin: typeof importDataSourcePlugin;
}

export interface TestDataSourceDependencies {
  getDatasourceSrv: typeof getDataSourceSrv;
  getBackendSrv: typeof getBackendSrv;
}

export const initDataSourceSettings = (
  uid: string,
  dependencies: InitDataSourceSettingDependencies = {
    loadDataSource,
    loadDataSourceMeta,
    getDataSource,
    getDataSourceMeta,
    importDataSourcePlugin,
  }
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (!uid) {
      dispatch(initDataSourceSettingsFailed(new Error('Invalid UID')));
      return;
    }

    try {
      const loadedDataSource = await dispatch(dependencies.loadDataSource(uid));
      await dispatch(dependencies.loadDataSourceMeta(loadedDataSource));

      const dataSource = dependencies.getDataSource(getState().dataSources, uid);
      const dataSourceMeta = dependencies.getDataSourceMeta(getState().dataSources, dataSource!.type);
      const importedPlugin = await dependencies.importDataSourcePlugin(dataSourceMeta);

      dispatch(initDataSourceSettingsSucceeded(importedPlugin));
    } catch (err) {
      if (err instanceof Error) {
        dispatch(initDataSourceSettingsFailed(err));
      }
    }
  };
};

export const testDataSource = (
  dataSourceName: string,
  dependencies: TestDataSourceDependencies = {
    getDatasourceSrv,
    getBackendSrv,
  }
): ThunkResult<void> => {
  return async (dispatch: ThunkDispatch, getState) => {
    const dsApi = await dependencies.getDatasourceSrv().get(dataSourceName);

    if (!dsApi.testDatasource) {
      return;
    }

    dispatch(testDataSourceStarting());

    dependencies.getBackendSrv().withNoBackendCache(async () => {
      try {
        const result = await dsApi.testDatasource();

        dispatch(testDataSourceSucceeded(result));
      } catch (err) {
        let message: string | undefined;
        let details: HealthCheckResultDetails;

        if (err instanceof HealthCheckError) {
          message = err.message;
          details = err.details;
        } else if (isFetchError(err)) {
          message = err.data.message ?? `HTTP error ${err.statusText}`;
        } else if (err instanceof Error) {
          message = err.message;
        }

        dispatch(testDataSourceFailed({ message, details }));
      }
    });
  };
};

export function loadDataSources(): ThunkResult<void> {
  return async (dispatch) => {
    const response = await api.getDataSources();
    dispatch(dataSourcesLoaded(response));
  };
}

export function loadDataSource(uid: string): ThunkResult<Promise<DataSourceSettings>> {
  return async (dispatch) => {
    let dataSource = await api.getDataSourceByIdOrUid(uid);

    // Reload route to use UID instead
    // -------------------------------
    // In case we were trying to fetch and reference a data-source with an old numeric ID
    // (which can happen by referencing it with a "old" URL), we would like to automatically redirect
    // to the new URL format using the UID.
    // [Please revalidate the following]: Unfortunately we can update the location using react router, but need to fully reload the
    // route as the nav model page index is not matching with the url in that case.
    // And react router has no way to unmount remount a route.
    if (uid !== dataSource.uid) {
      window.location.href = locationUtil.assureBaseUrl(`/datasources/edit/${dataSource.uid}`);

      // Avoid a flashing error while the reload happens
      dataSource = {} as DataSourceSettings;
    }

    dispatch(dataSourceLoaded(dataSource));

    return dataSource;
  };
}

export function loadDataSourceMeta(dataSource: DataSourceSettings): ThunkResult<void> {
  return async (dispatch) => {
    const pluginInfo = (await getPluginSettings(dataSource.type)) as DataSourcePluginMeta;
    const plugin = await importDataSourcePlugin(pluginInfo);
    const isBackend = plugin.DataSourceClass.prototype instanceof DataSourceWithBackend;
    const meta = {
      ...pluginInfo,
      isBackend: pluginInfo.backend || isBackend,
    };

    dispatch(dataSourceMetaLoaded(meta));

    plugin.meta = meta;
    dispatch(updateNavIndex(buildNavModel(dataSource, plugin)));
  };
}

export function addDataSource(plugin: DataSourcePluginMeta): ThunkResult<void> {
  return async (dispatch, getStore) => {
    await dispatch(loadDataSources());

    const dataSources = getStore().dataSources.dataSources;
    const isFirstDataSource = dataSources.length === 0;
    const newInstance = {
      name: plugin.name,
      type: plugin.id,
      access: 'proxy',
      isDefault: isFirstDataSource,
    };

    if (nameExits(dataSources, newInstance.name)) {
      newInstance.name = findNewName(dataSources, newInstance.name);
    }

    const result = await api.createDataSource(newInstance);

    await getDatasourceSrv().reload();
    await contextSrv.fetchUserPermissions();

    locationService.push(`/datasources/edit/${result.datasource.uid}`);
  };
}

export function loadDataSourcePlugins(): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(dataSourcePluginsLoad());
    const plugins = await api.getDataSourcePlugins();
    const categories = buildCategories(plugins);
    dispatch(dataSourcePluginsLoaded({ plugins, categories }));
  };
}

export function updateDataSource(dataSource: DataSourceSettings): ThunkResult<void> {
  return async (dispatch) => {
    await api.updateDataSource(dataSource);
    await getDatasourceSrv().reload();
    return dispatch(loadDataSource(dataSource.uid));
  };
}

export function deleteLoadedDataSource(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const { uid } = getStore().dataSources.dataSource;

    await api.deleteDataSource(uid);
    await getDatasourceSrv().reload();

    locationService.push('/datasources');
  };
}

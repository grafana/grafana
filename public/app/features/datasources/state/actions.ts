import config from '../../../core/config';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { updateLocation, updateNavIndex } from 'app/core/actions';
import { buildNavModel } from './navModel';
import { DataSourcePluginMeta, DataSourceSettings } from '@grafana/data';
import { DataSourcePluginCategory, ThunkResult, ThunkDispatch } from 'app/types';
import { getPluginSettings } from 'app/features/plugins/PluginSettingsCache';
import { importDataSourcePlugin } from 'app/features/plugins/plugin_loader';
import {
  dataSourceLoaded,
  dataSourceMetaLoaded,
  dataSourcePluginsLoad,
  dataSourcePluginsLoaded,
  dataSourcesLoaded,
  initDataSourceSettingsFailed,
  initDataSourceSettingsSucceeded,
  testDataSourceStarting,
  testDataSourceSucceeded,
  testDataSourceFailed,
} from './reducers';
import { buildCategories } from './buildCategories';
import { getDataSource, getDataSourceMeta } from './selectors';
import { getDataSourceSrv } from '@grafana/runtime';

export interface DataSourceTypesLoadedPayload {
  plugins: DataSourcePluginMeta[];
  categories: DataSourcePluginCategory[];
}

export interface InitDataSourceSettingDependencies {
  loadDataSource: typeof loadDataSource;
  getDataSource: typeof getDataSource;
  getDataSourceMeta: typeof getDataSourceMeta;
  importDataSourcePlugin: typeof importDataSourcePlugin;
}

export interface TestDataSourceDependencies {
  getDatasourceSrv: typeof getDataSourceSrv;
  getBackendSrv: typeof getBackendSrv;
}

export const initDataSourceSettings = (
  pageId: number,
  dependencies: InitDataSourceSettingDependencies = {
    loadDataSource,
    getDataSource,
    getDataSourceMeta,
    importDataSourcePlugin,
  }
): ThunkResult<void> => {
  return async (dispatch: ThunkDispatch, getState) => {
    if (isNaN(pageId)) {
      dispatch(initDataSourceSettingsFailed(new Error('Invalid ID')));
      return;
    }

    try {
      await dispatch(dependencies.loadDataSource(pageId));
      if (getState().dataSourceSettings.plugin) {
        return;
      }

      const dataSource = dependencies.getDataSource(getState().dataSources, pageId);
      const dataSourceMeta = dependencies.getDataSourceMeta(getState().dataSources, dataSource.type);
      const importedPlugin = await dependencies.importDataSourcePlugin(dataSourceMeta);

      dispatch(initDataSourceSettingsSucceeded(importedPlugin));
    } catch (err) {
      console.log('Failed to import plugin module', err);
      dispatch(initDataSourceSettingsFailed(err));
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
        let message = '';

        if (err.statusText) {
          message = 'HTTP Error ' + err.statusText;
        } else {
          message = err.message;
        }

        dispatch(testDataSourceFailed({ message }));
      }
    });
  };
};

export function loadDataSources(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/datasources');
    dispatch(dataSourcesLoaded(response));
  };
}

export function loadDataSource(id: number): ThunkResult<void> {
  return async dispatch => {
    const dataSource = await getBackendSrv().get(`/api/datasources/${id}`);
    const pluginInfo = (await getPluginSettings(dataSource.type)) as DataSourcePluginMeta;
    const plugin = await importDataSourcePlugin(pluginInfo);

    dispatch(dataSourceLoaded(dataSource));
    dispatch(dataSourceMetaLoaded(pluginInfo));
    dispatch(updateNavIndex(buildNavModel(dataSource, plugin)));
  };
}

export function addDataSource(plugin: DataSourcePluginMeta): ThunkResult<void> {
  return async (dispatch, getStore) => {
    await dispatch(loadDataSources());

    const dataSources = getStore().dataSources.dataSources;

    const newInstance = {
      name: plugin.name,
      type: plugin.id,
      access: 'proxy',
      isDefault: dataSources.length === 0,
    };

    if (nameExits(dataSources, newInstance.name)) {
      newInstance.name = findNewName(dataSources, newInstance.name);
    }

    const result = await getBackendSrv().post('/api/datasources', newInstance);
    dispatch(updateLocation({ path: `/datasources/edit/${result.id}` }));
  };
}

export function loadDataSourcePlugins(): ThunkResult<void> {
  return async dispatch => {
    dispatch(dataSourcePluginsLoad());
    const plugins = await getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });
    const categories = buildCategories(plugins);
    dispatch(dataSourcePluginsLoaded({ plugins, categories }));
  };
}

export function updateDataSource(dataSource: DataSourceSettings): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().put(`/api/datasources/${dataSource.id}`, dataSource);
    await updateFrontendSettings();
    return dispatch(loadDataSource(dataSource.id));
  };
}

export function deleteDataSource(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const dataSource = getStore().dataSources.dataSource;
    await getBackendSrv().delete(`/api/datasources/${dataSource.id}`);
    await updateFrontendSettings();
    dispatch(updateLocation({ path: '/datasources' }));
  };
}

interface ItemWithName {
  name: string;
}

export function nameExits(dataSources: ItemWithName[], name: string) {
  return (
    dataSources.filter(dataSource => {
      return dataSource.name.toLowerCase() === name.toLowerCase();
    }).length > 0
  );
}

export function findNewName(dataSources: ItemWithName[], name: string) {
  // Need to loop through current data sources to make sure
  // the name doesn't exist
  while (nameExits(dataSources, name)) {
    // If there's a duplicate name that doesn't end with '-x'
    // we can add -1 to the name and be done.
    if (!nameHasSuffix(name)) {
      name = `${name}-1`;
    } else {
      // if there's a duplicate name that ends with '-x'
      // we can try to increment the last digit until the name is unique

      // remove the 'x' part and replace it with the new number
      name = `${getNewName(name)}${incrementLastDigit(getLastDigit(name))}`;
    }
  }

  return name;
}

function updateFrontendSettings() {
  return getBackendSrv()
    .get('/api/frontend/settings')
    .then((settings: any) => {
      config.datasources = settings.datasources;
      config.defaultDatasource = settings.defaultDatasource;
      getDatasourceSrv().init();
    });
}

function nameHasSuffix(name: string) {
  return name.endsWith('-', name.length - 1);
}

function getLastDigit(name: string) {
  return parseInt(name.slice(-1), 10);
}

function incrementLastDigit(digit: number) {
  return isNaN(digit) ? 1 : digit + 1;
}

function getNewName(name: string) {
  return name.slice(0, name.length - 1);
}

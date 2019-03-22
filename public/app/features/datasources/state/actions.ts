import { ThunkAction } from 'redux-thunk';
import config from '../../../core/config';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { LayoutMode } from 'app/core/components/LayoutSelector/LayoutSelector';
import { updateLocation, updateNavIndex, UpdateNavIndexAction } from 'app/core/actions';
import { buildNavModel } from './navModel';
import { DataSourceSettings } from '@grafana/ui/src/types';
import { Plugin, StoreState, LocationUpdate } from 'app/types';
import { actionCreatorFactory } from 'app/core/redux';
import { ActionOf, noPayloadActionCreatorFactory } from 'app/core/redux/actionCreatorFactory';

export const dataSourceLoaded = actionCreatorFactory<DataSourceSettings>('LOAD_DATA_SOURCE').create();

export const dataSourcesLoaded = actionCreatorFactory<DataSourceSettings[]>('LOAD_DATA_SOURCES').create();

export const dataSourceMetaLoaded = actionCreatorFactory<Plugin>('LOAD_DATA_SOURCE_META').create();

export const dataSourceTypesLoad = noPayloadActionCreatorFactory('LOAD_DATA_SOURCE_TYPES').create();

export const dataSourceTypesLoaded = actionCreatorFactory<Plugin[]>('LOADED_DATA_SOURCE_TYPES').create();

export const setDataSourcesSearchQuery = actionCreatorFactory<string>('SET_DATA_SOURCES_SEARCH_QUERY').create();

export const setDataSourcesLayoutMode = actionCreatorFactory<LayoutMode>('SET_DATA_SOURCES_LAYOUT_MODE').create();

export const setDataSourceTypeSearchQuery = actionCreatorFactory<string>('SET_DATA_SOURCE_TYPE_SEARCH_QUERY').create();

export const setDataSourceName = actionCreatorFactory<string>('SET_DATA_SOURCE_NAME').create();

export const setIsDefault = actionCreatorFactory<boolean>('SET_IS_DEFAULT').create();

export type Action =
  | UpdateNavIndexAction
  | ActionOf<DataSourceSettings>
  | ActionOf<DataSourceSettings[]>
  | ActionOf<Plugin>
  | ActionOf<Plugin[]>
  | ActionOf<LocationUpdate>;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadDataSources(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/datasources');
    dispatch(dataSourcesLoaded(response));
  };
}

export function loadDataSource(id: number): ThunkResult<void> {
  return async dispatch => {
    const dataSource = await getBackendSrv().get(`/api/datasources/${id}`);
    const pluginInfo = await getBackendSrv().get(`/api/plugins/${dataSource.type}/settings`);
    dispatch(dataSourceLoaded(dataSource));
    dispatch(dataSourceMetaLoaded(pluginInfo));
    dispatch(updateNavIndex(buildNavModel(dataSource, pluginInfo)));
  };
}

export function addDataSource(plugin: Plugin): ThunkResult<void> {
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

export function loadDataSourceTypes(): ThunkResult<void> {
  return async dispatch => {
    dispatch(dataSourceTypesLoad());
    const result = await getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });
    dispatch(dataSourceTypesLoaded(result));
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
    dispatch(updateLocation({ path: '/datasources' }));
  };
}

export function nameExits(dataSources, name) {
  return (
    dataSources.filter(dataSource => {
      return dataSource.name.toLowerCase() === name.toLowerCase();
    }).length > 0
  );
}

export function findNewName(dataSources, name) {
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
    .then(settings => {
      config.datasources = settings.datasources;
      config.defaultDatasource = settings.defaultDatasource;
      getDatasourceSrv().init();
    });
}

function nameHasSuffix(name) {
  return name.endsWith('-', name.length - 1);
}

function getLastDigit(name) {
  return parseInt(name.slice(-1), 10);
}

function incrementLastDigit(digit) {
  return isNaN(digit) ? 1 : digit + 1;
}

function getNewName(name) {
  return name.slice(0, name.length - 1);
}

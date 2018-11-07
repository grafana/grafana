import { ThunkAction } from 'redux-thunk';
import { DataSource, Plugin, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { LayoutMode } from '../../../core/components/LayoutSelector/LayoutSelector';
import { updateLocation, updateNavIndex, UpdateNavIndexAction } from '../../../core/actions';
import { UpdateLocationAction } from '../../../core/actions/location';
import { buildNavModel } from './navModel';

import config from '../../../core/config';

export enum ActionTypes {
  LoadDataSources = 'LOAD_DATA_SOURCES',
  LoadDataSourceTypes = 'LOAD_DATA_SOURCE_TYPES',
  LoadDataSource = 'LOAD_DATA_SOURCE',
  LoadDataSourceMeta = 'LOAD_DATA_SOURCE_META',
  SetDataSourcesSearchQuery = 'SET_DATA_SOURCES_SEARCH_QUERY',
  SetDataSourcesLayoutMode = 'SET_DATA_SOURCES_LAYOUT_MODE',
  SetDataSourceTypeSearchQuery = 'SET_DATA_SOURCE_TYPE_SEARCH_QUERY',
  SetDataSourceName = 'SET_DATA_SOURCE_NAME',
  SetDataSourceTestingProgess = 'SET_TESTING_PROGRESS',
  SetDataSourceTestingSuccess = 'SET_DATA_SOURCE_TESTING_SUCCESS',
  SetDataSourceTestingFail = 'SET_DATA_SOURCE_TESTING_FAIL',
}

interface LoadDataSourcesAction {
  type: ActionTypes.LoadDataSources;
  payload: DataSource[];
}

interface SetDataSourcesSearchQueryAction {
  type: ActionTypes.SetDataSourcesSearchQuery;
  payload: string;
}

interface SetDataSourcesLayoutModeAction {
  type: ActionTypes.SetDataSourcesLayoutMode;
  payload: LayoutMode;
}

interface LoadDataSourceTypesAction {
  type: ActionTypes.LoadDataSourceTypes;
  payload: Plugin[];
}

interface SetDataSourceTypeSearchQueryAction {
  type: ActionTypes.SetDataSourceTypeSearchQuery;
  payload: string;
}

interface LoadDataSourceAction {
  type: ActionTypes.LoadDataSource;
  payload: DataSource;
}

interface LoadDataSourceMetaAction {
  type: ActionTypes.LoadDataSourceMeta;
  payload: Plugin;
}

interface SetDataSourceNameAction {
  type: ActionTypes.SetDataSourceName;
  payload: string;
}

interface SetDataSourceTestingProgessAction {
  type: ActionTypes.SetDataSourceTestingProgess;
  payload: boolean;
}

interface SetDataSourceTestingSuccessAction {
  type: ActionTypes.SetDataSourceTestingSuccess;
  payload: { status: string; message: string };
}

interface SetDataSourceTestingFailAction {
  type: ActionTypes.SetDataSourceTestingFail;
  payload: string;
}

const dataSourcesLoaded = (dataSources: DataSource[]): LoadDataSourcesAction => ({
  type: ActionTypes.LoadDataSources,
  payload: dataSources,
});

const dataSourceLoaded = (dataSource: DataSource): LoadDataSourceAction => ({
  type: ActionTypes.LoadDataSource,
  payload: dataSource,
});

const dataSourceMetaLoaded = (dataSourceMeta: Plugin): LoadDataSourceMetaAction => ({
  type: ActionTypes.LoadDataSourceMeta,
  payload: dataSourceMeta,
});

const dataSourceTypesLoaded = (dataSourceTypes: Plugin[]): LoadDataSourceTypesAction => ({
  type: ActionTypes.LoadDataSourceTypes,
  payload: dataSourceTypes,
});

export const setDataSourcesSearchQuery = (searchQuery: string): SetDataSourcesSearchQueryAction => ({
  type: ActionTypes.SetDataSourcesSearchQuery,
  payload: searchQuery,
});

export const setDataSourcesLayoutMode = (layoutMode: LayoutMode): SetDataSourcesLayoutModeAction => ({
  type: ActionTypes.SetDataSourcesLayoutMode,
  payload: layoutMode,
});

export const setDataSourceTypeSearchQuery = (query: string): SetDataSourceTypeSearchQueryAction => ({
  type: ActionTypes.SetDataSourceTypeSearchQuery,
  payload: query,
});

export const setDataSourceName = (name: string) => ({
  type: ActionTypes.SetDataSourceName,
  payload: name,
});

const setDataSourceTestingProgress = (state: boolean): SetDataSourceTestingProgessAction => ({
  type: ActionTypes.SetDataSourceTestingProgess,
  payload: state,
});

const setDataSourceTestingSuccess = (status: string, message: string): SetDataSourceTestingSuccessAction => ({
  type: ActionTypes.SetDataSourceTestingSuccess,
  payload: {
    status: status,
    message: message,
  },
});

const setDataSourceTestingFail = (message: string): SetDataSourceTestingFailAction => ({
  type: ActionTypes.SetDataSourceTestingFail,
  payload: message,
});

export type Action =
  | LoadDataSourcesAction
  | SetDataSourcesSearchQueryAction
  | SetDataSourcesLayoutModeAction
  | UpdateLocationAction
  | LoadDataSourceTypesAction
  | SetDataSourceTypeSearchQueryAction
  | LoadDataSourceAction
  | UpdateNavIndexAction
  | LoadDataSourceMetaAction
  | SetDataSourceNameAction
  | SetDataSourceTestingProgessAction
  | SetDataSourceTestingSuccessAction
  | SetDataSourceTestingFailAction;

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
    const result = await getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });
    dispatch(dataSourceTypesLoaded(result));
  };
}

export function updateDataSource(dataSource: DataSource): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv()
      .put(`/api/datasources/${dataSource.id}`, dataSource)
      .then(response => {
        updateFrontendSettings().then(() => {
          testDataSource(dispatch, response.name);
        });
      });

    dispatch(loadDataSource(dataSource.id));
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
      return dataSource.name === name;
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

function testDataSource(dispatch, name) {
  dispatch(setDataSourceTestingProgress(true));
  getDatasourceSrv()
    .get(name)
    .then(dataSource => {
      if (!dataSource.testDatasource) {
        return;
      }

      // make test call in no backend cache context
      getBackendSrv()
        .withNoBackendCache(() => {
          return dataSource
            .testDatasource()
            .then(result => {
              dispatch(setDataSourceTestingSuccess(result.status, result.message));
            })
            .catch(err => {
              let message = '';

              if (err.statusText) {
                message = 'HTTP Error ' + err.statusText;
              } else {
                message = err.message;
              }
              dispatch(setDataSourceTestingFail(message));
            });
        })
        .finally(() => {
          dispatch(setDataSourceTestingProgress(false));
        });
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

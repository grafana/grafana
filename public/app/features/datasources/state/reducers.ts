import { AnyAction, createAction } from '@reduxjs/toolkit';

import { DataSourcePluginMeta, DataSourceSettings, LayoutMode, LayoutModes } from '@grafana/data';
import { DataSourcesState, DataSourceSettingsState, TestingStatus } from 'app/types';

import { GenericDataSourcePlugin } from '../types';

import { DataSourceTypesLoadedPayload } from './actions';

export const initialState: DataSourcesState = {
  dataSources: [],
  plugins: [],
  categories: [],
  dataSource: {} as DataSourceSettings,
  layoutMode: LayoutModes.List,
  searchQuery: '',
  dataSourcesCount: 0,
  dataSourceTypeSearchQuery: '',
  hasFetched: false,
  isLoadingDataSources: false,
  dataSourceMeta: {} as DataSourcePluginMeta,
};

export const dataSourceLoaded = createAction<DataSourceSettings>('dataSources/dataSourceLoaded');
export const dataSourcesLoaded = createAction<DataSourceSettings[]>('dataSources/dataSourcesLoaded');
export const dataSourceMetaLoaded = createAction<DataSourcePluginMeta>('dataSources/dataSourceMetaLoaded');
export const dataSourcePluginsLoad = createAction('dataSources/dataSourcePluginsLoad');
export const dataSourcePluginsLoaded = createAction<DataSourceTypesLoadedPayload>(
  'dataSources/dataSourcePluginsLoaded'
);
export const setDataSourcesSearchQuery = createAction<string>('dataSources/setDataSourcesSearchQuery');
export const setDataSourcesLayoutMode = createAction<LayoutMode>('dataSources/setDataSourcesLayoutMode');
export const setDataSourceTypeSearchQuery = createAction<string>('dataSources/setDataSourceTypeSearchQuery');
export const setDataSourceName = createAction<string>('dataSources/setDataSourceName');
export const setIsDefault = createAction<boolean>('dataSources/setIsDefault');

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const dataSourcesReducer = (state: DataSourcesState = initialState, action: AnyAction): DataSourcesState => {
  if (dataSourcesLoaded.match(action)) {
    return {
      ...state,
      hasFetched: true,
      dataSources: action.payload,
      dataSourcesCount: action.payload.length,
    };
  }

  if (dataSourceLoaded.match(action)) {
    return { ...state, dataSource: action.payload };
  }

  if (setDataSourcesSearchQuery.match(action)) {
    return { ...state, searchQuery: action.payload };
  }

  if (setDataSourcesLayoutMode.match(action)) {
    return { ...state, layoutMode: action.payload };
  }

  if (dataSourcePluginsLoad.match(action)) {
    return { ...state, plugins: [], isLoadingDataSources: true };
  }

  if (dataSourcePluginsLoaded.match(action)) {
    return {
      ...state,
      plugins: action.payload.plugins,
      categories: action.payload.categories,
      isLoadingDataSources: false,
    };
  }

  if (setDataSourceTypeSearchQuery.match(action)) {
    return { ...state, dataSourceTypeSearchQuery: action.payload };
  }

  if (dataSourceMetaLoaded.match(action)) {
    return { ...state, dataSourceMeta: action.payload };
  }

  if (setDataSourceName.match(action)) {
    return { ...state, dataSource: { ...state.dataSource, name: action.payload } };
  }

  if (setIsDefault.match(action)) {
    return {
      ...state,
      dataSource: { ...state.dataSource, isDefault: action.payload },
    };
  }

  return state;
};

export const initialDataSourceSettingsState: DataSourceSettingsState = {
  testingStatus: {},
  loadError: null,
  loading: true,
  plugin: null,
};

export const initDataSourceSettingsSucceeded = createAction<GenericDataSourcePlugin>(
  'dataSourceSettings/initDataSourceSettingsSucceeded'
);

export const initDataSourceSettingsFailed = createAction<Error>('dataSourceSettings/initDataSourceSettingsFailed');

export const testDataSourceStarting = createAction<undefined>('dataSourceSettings/testDataSourceStarting');

export const testDataSourceSucceeded = createAction<TestingStatus>('dataSourceSettings/testDataSourceSucceeded');

export const testDataSourceFailed = createAction<TestingStatus>('dataSourceSettings/testDataSourceFailed');

export const dataSourceSettingsReducer = (
  state: DataSourceSettingsState = initialDataSourceSettingsState,
  action: AnyAction
): DataSourceSettingsState => {
  if (initDataSourceSettingsSucceeded.match(action)) {
    return { ...state, plugin: action.payload, loadError: null, loading: false };
  }

  if (initDataSourceSettingsFailed.match(action)) {
    return { ...state, plugin: null, loadError: action.payload.message, loading: false };
  }

  if (testDataSourceStarting.match(action)) {
    return {
      ...state,
      testingStatus: {
        message: 'Testing...',
        status: 'info',
      },
    };
  }

  if (testDataSourceSucceeded.match(action)) {
    return {
      ...state,
      testingStatus: {
        status: action.payload?.status,
        message: action.payload?.message,
        details: action.payload?.details,
      },
    };
  }

  if (testDataSourceFailed.match(action)) {
    return {
      ...state,
      testingStatus: {
        status: 'error',
        message: action.payload?.message,
        details: action.payload?.details,
      },
    };
  }

  return state;
};

export default {
  dataSources: dataSourcesReducer,
  dataSourceSettings: dataSourceSettingsReducer,
};

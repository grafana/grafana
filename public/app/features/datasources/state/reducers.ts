import { AnyAction, createAction } from '@reduxjs/toolkit';
import { DataSourcePluginMeta, DataSourceSettings } from '@grafana/data';

import { DataSourcesState } from 'app/types';
import { LayoutMode, LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
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

export const dataSourceLoaded = createAction<DataSourceSettings>('LOAD_DATA_SOURCE');
export const dataSourcesLoaded = createAction<DataSourceSettings[]>('LOAD_DATA_SOURCES');
export const dataSourceMetaLoaded = createAction<DataSourcePluginMeta>('LOAD_DATA_SOURCE_META');
export const dataSourcePluginsLoad = createAction('LOAD_DATA_SOURCE_PLUGINS');
export const dataSourcePluginsLoaded = createAction<DataSourceTypesLoadedPayload>('LOADED_DATA_SOURCE_PLUGINS');
export const setDataSourcesSearchQuery = createAction<string>('SET_DATA_SOURCES_SEARCH_QUERY');
export const setDataSourcesLayoutMode = createAction<LayoutMode>('SET_DATA_SOURCES_LAYOUT_MODE');
export const setDataSourceTypeSearchQuery = createAction<string>('SET_DATA_SOURCE_TYPE_SEARCH_QUERY');
export const setDataSourceName = createAction<string>('SET_DATA_SOURCE_NAME');
export const setIsDefault = createAction<boolean>('SET_IS_DEFAULT');

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

export default {
  dataSources: dataSourcesReducer,
};

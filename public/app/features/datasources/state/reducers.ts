import { createAction } from '@reduxjs/toolkit';
import { DataSourcePluginMeta, DataSourceSettings } from '@grafana/data';

import { DataSourcesState } from 'app/types';
import { LayoutMode, LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
import { Action } from 'redux';

export const initialState: DataSourcesState = {
  dataSources: [],
  dataSource: {} as DataSourceSettings,
  layoutMode: LayoutModes.List,
  searchQuery: '',
  dataSourcesCount: 0,
  dataSourceTypes: [],
  dataSourceTypeSearchQuery: '',
  hasFetched: false,
  isLoadingDataSources: false,
  dataSourceMeta: {} as DataSourcePluginMeta,
};

export const dataSourceLoaded = createAction<DataSourceSettings>('dataSources/dataSourceLoaded');

export const dataSourcesLoaded = createAction<DataSourceSettings[]>('dataSources/dataSourcesLoaded');

export const dataSourceMetaLoaded = createAction<DataSourcePluginMeta>('dataSources/dataSourceMetaLoaded');

export const dataSourceTypesLoad = createAction('dataSources/dataSourceTypesLoad');

export const dataSourceTypesLoaded = createAction<DataSourcePluginMeta[]>('dataSources/dataSourceTypesLoaded');

export const setDataSourcesSearchQuery = createAction<string>('dataSources/setDataSourcesSearchQuery');

export const setDataSourcesLayoutMode = createAction<LayoutMode>('dataSources/setDataSourcesLayoutMode');

export const setDataSourceTypeSearchQuery = createAction<string>('dataSources/setDataSourceTypeSearchQuery');

export const setDataSourceName = createAction<string>('dataSources/setDataSourceName');

export const setIsDefault = createAction<boolean>('dataSources/setIsDefault');

export const dataSourcesReducer = (
  state: DataSourcesState = initialState,
  action: Action<unknown>
): DataSourcesState => {
  if (dataSourceLoaded.match(action)) {
    return {
      ...state,
      dataSource: action.payload,
    };
  }

  if (dataSourcesLoaded.match(action)) {
    return {
      ...state,
      hasFetched: true,
      dataSources: action.payload,
      dataSourcesCount: action.payload.length,
    };
  }

  if (dataSourceMetaLoaded.match(action)) {
    return {
      ...state,
      dataSourceMeta: action.payload,
    };
  }

  if (dataSourceTypesLoad.match(action)) {
    return {
      ...state,
      dataSourceTypes: [],
      isLoadingDataSources: true,
    };
  }

  if (dataSourceTypesLoaded.match(action)) {
    return {
      ...state,
      dataSourceTypes: action.payload,
      isLoadingDataSources: false,
    };
  }

  if (dataSourceTypesLoaded.match(action)) {
    return {
      ...state,
      dataSourceTypes: action.payload,
      isLoadingDataSources: false,
    };
  }

  if (setDataSourcesSearchQuery.match(action)) {
    return {
      ...state,
      searchQuery: action.payload,
    };
  }

  if (setDataSourcesLayoutMode.match(action)) {
    return {
      ...state,
      layoutMode: action.payload,
    };
  }

  if (setDataSourceTypeSearchQuery.match(action)) {
    return {
      ...state,
      dataSourceTypeSearchQuery: action.payload,
    };
  }

  if (setDataSourceName.match(action)) {
    return {
      ...state,
      dataSource: {
        ...state.dataSource,
        name: action.payload,
      },
    };
  }

  if (setIsDefault.match(action)) {
    return {
      ...state,
      dataSource: {
        ...state.dataSource,
        isDefault: action.payload,
      },
    };
  }

  return state;
};

export default {
  dataSources: dataSourcesReducer,
};

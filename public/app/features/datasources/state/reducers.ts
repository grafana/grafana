import { DataSourcesState } from 'app/types';
import { DataSourceSettings, DataSourcePluginMeta } from '@grafana/ui';
import {
  dataSourceLoaded,
  dataSourcesLoaded,
  setDataSourcesSearchQuery,
  setDataSourcesLayoutMode,
  dataSourceTypesLoad,
  dataSourceTypesLoaded,
  setDataSourceTypeSearchQuery,
  dataSourceMetaLoaded,
  setDataSourceName,
  setIsDefault,
} from './actions';
import { LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
import { reducerFactory } from 'app/core/redux';

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

export const dataSourcesReducer = reducerFactory(initialState)
  .addMapper({
    filter: dataSourcesLoaded,
    mapper: (state, action) => ({
      ...state,
      hasFetched: true,
      dataSources: action.payload,
      dataSourcesCount: action.payload.length,
    }),
  })
  .addMapper({
    filter: dataSourceLoaded,
    mapper: (state, action) => ({ ...state, dataSource: action.payload }),
  })
  .addMapper({
    filter: setDataSourcesSearchQuery,
    mapper: (state, action) => ({ ...state, searchQuery: action.payload }),
  })
  .addMapper({
    filter: setDataSourcesLayoutMode,
    mapper: (state, action) => ({ ...state, layoutMode: action.payload }),
  })
  .addMapper({
    filter: dataSourceTypesLoad,
    mapper: state => ({ ...state, dataSourceTypes: [], isLoadingDataSources: true }),
  })
  .addMapper({
    filter: dataSourceTypesLoaded,
    mapper: (state, action) => ({
      ...state,
      dataSourceTypes: action.payload,
      isLoadingDataSources: false,
    }),
  })
  .addMapper({
    filter: setDataSourceTypeSearchQuery,
    mapper: (state, action) => ({ ...state, dataSourceTypeSearchQuery: action.payload }),
  })
  .addMapper({
    filter: dataSourceMetaLoaded,
    mapper: (state, action) => ({ ...state, dataSourceMeta: action.payload }),
  })
  .addMapper({
    filter: setDataSourceName,
    mapper: (state, action) => ({ ...state, dataSource: { ...state.dataSource, name: action.payload } }),
  })
  .addMapper({
    filter: setIsDefault,
    mapper: (state, action) => ({
      ...state,
      dataSource: { ...state.dataSource, isDefault: action.payload },
    }),
  })
  .create();

export default {
  dataSources: dataSourcesReducer,
};

import { DataSourcesState, Plugin } from 'app/types';
import { DataSourceSettings } from '@grafana/ui/src/types';
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

const initialState: DataSourcesState = {
  dataSources: [],
  dataSource: {} as DataSourceSettings,
  layoutMode: LayoutModes.List,
  searchQuery: '',
  dataSourcesCount: 0,
  dataSourceTypes: [],
  dataSourceTypeSearchQuery: '',
  hasFetched: false,
  isLoadingDataSources: false,
  dataSourceMeta: {} as Plugin,
};

export const dataSourcesReducer = reducerFactory(initialState)
  .addHandler({
    filter: dataSourcesLoaded,
    mapper: (state, action) => ({
      ...state,
      hasFetched: true,
      dataSources: action.payload,
      dataSourcesCount: action.payload.length,
    }),
  })
  .addHandler({
    filter: dataSourceLoaded,
    mapper: (state, action) => ({ ...state, dataSource: action.payload }),
  })
  .addHandler({
    filter: setDataSourcesSearchQuery,
    mapper: (state, action) => ({ ...state, searchQuery: action.payload }),
  })
  .addHandler({
    filter: setDataSourcesLayoutMode,
    mapper: (state, action) => ({ ...state, layoutMode: action.payload }),
  })
  .addHandler({
    filter: dataSourceTypesLoad,
    mapper: state => ({ ...state, dataSourceTypes: [], isLoadingDataSources: true }),
  })
  .addHandler({
    filter: dataSourceTypesLoaded,
    mapper: (state, action) => ({
      ...state,
      dataSourceTypes: action.payload,
      isLoadingDataSources: false,
    }),
  })
  .addHandler({
    filter: setDataSourceTypeSearchQuery,
    mapper: (state, action) => ({ ...state, dataSourceTypeSearchQuery: action.payload }),
  })
  .addHandler({
    filter: dataSourceMetaLoaded,
    mapper: (state, action) => ({ ...state, dataSourceMeta: action.payload }),
  })
  .addHandler({
    filter: setDataSourceName,
    mapper: (state, action) => ({ ...state, dataSource: { ...state.dataSource, name: action.payload } }),
  })
  .addHandler({
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

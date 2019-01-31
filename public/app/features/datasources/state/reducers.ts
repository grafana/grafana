import { DataSourcesState, Plugin } from 'app/types';
import { DataSourceSettings } from '@grafana/ui/src/types';
import { Action, ActionTypes } from './actions';
import { LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';

const initialState: DataSourcesState = {
  dataSources: [] as DataSourceSettings[],
  dataSource: {} as DataSourceSettings,
  layoutMode: LayoutModes.List,
  searchQuery: '',
  dataSourcesCount: 0,
  dataSourceTypes: [] as Plugin[],
  dataSourceTypeSearchQuery: '',
  hasFetched: false,
  isLoadingDataSources: false,
  dataSourceMeta: {} as Plugin,
};

export const dataSourcesReducer = (state = initialState, action: Action): DataSourcesState => {
  switch (action.type) {
    case ActionTypes.LoadDataSources:
      return { ...state, hasFetched: true, dataSources: action.payload, dataSourcesCount: action.payload.length };

    case ActionTypes.LoadDataSource:
      return { ...state, dataSource: action.payload };

    case ActionTypes.SetDataSourcesSearchQuery:
      return { ...state, searchQuery: action.payload };

    case ActionTypes.SetDataSourcesLayoutMode:
      return { ...state, layoutMode: action.payload };

    case ActionTypes.LoadDataSourceTypes:
      return { ...state, dataSourceTypes: [], isLoadingDataSources: true };

    case ActionTypes.LoadedDataSourceTypes:
      return { ...state, dataSourceTypes: action.payload, isLoadingDataSources: false };

    case ActionTypes.SetDataSourceTypeSearchQuery:
      return { ...state, dataSourceTypeSearchQuery: action.payload };

    case ActionTypes.LoadDataSourceMeta:
      return { ...state, dataSourceMeta: action.payload };

    case ActionTypes.SetDataSourceName:
      return { ...state, dataSource: { ...state.dataSource, name: action.payload } };

    case ActionTypes.SetIsDefault:
      return { ...state, dataSource: { ...state.dataSource, isDefault: action.payload } };
  }

  return state;
};

export default {
  dataSources: dataSourcesReducer,
};

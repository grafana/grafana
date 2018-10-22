import { DataSource, DataSourcesState, Plugin } from 'app/types';
import { Action, ActionTypes } from './actions';
import { LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';

const initialState: DataSourcesState = {
  dataSources: [] as DataSource[],
  dataSource: {} as DataSource,
  layoutMode: LayoutModes.Grid,
  searchQuery: '',
  dataSourcesCount: 0,
  dataSourceTypes: [] as Plugin[],
  dataSourceTypeSearchQuery: '',
  dataSourceMeta: {} as Plugin,
  hasFetched: false,
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
      return { ...state, dataSourceTypes: action.payload };

    case ActionTypes.SetDataSourceTypeSearchQuery:
      return { ...state, dataSourceTypeSearchQuery: action.payload };

    case ActionTypes.LoadDataSourceMeta:
      return { ...state, dataSourceMeta: action.payload };
  }

  return state;
};

export default {
  dataSources: dataSourcesReducer,
};

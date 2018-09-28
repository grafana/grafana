import { DataSource, DataSourcesState } from 'app/types';
import { Action, ActionTypes } from './actions';
import { LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';

const initialState: DataSourcesState = {
  dataSources: [] as DataSource[],
  layoutMode: LayoutModes.Grid,
  searchQuery: '',
};

export const dataSourcesReducer = (state = initialState, action: Action): DataSourcesState => {
  switch (action.type) {
    case ActionTypes.LoadDataSources:
      return { ...state, dataSources: action.payload };

    case ActionTypes.SetDataSourcesSearchQuery:
      return { ...state, searchQuery: action.payload };

    case ActionTypes.SetDataSourcesLayoutMode:
      return { ...state, layoutMode: action.payload };
  }

  return state;
};

export default {
  dataSources: dataSourcesReducer,
};

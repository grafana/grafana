import { SearchQuery, SearchAction, SearchLayout } from '../../types';

import { LAYOUT_CHANGE, QUERY_CHANGE, TOGGLE_SORT, DS_INSTANCE_URL, FIELD_ERR, FILTER_TYPE } from './actionTypes';

export const defaultQuery: SearchQuery = {
  query: '',
  sort: null,
  layout: SearchLayout.Module,
  filterType: '',
  dsInstanceUrl: '',
  calcFieldErr: '',
};

export const queryReducer = (state: SearchQuery, action: SearchAction) => {
  switch (action.type) {
    case QUERY_CHANGE:
      return { ...state, query: action.payload };
    case TOGGLE_SORT: {
      const sort = action.payload;
      return { ...state, sort };
    }
    case LAYOUT_CHANGE: {
      const layout = action.payload;
      return { ...state, layout, query: '', filterType: '' };
    }
    case FILTER_TYPE: {
      return { ...state, filterType: action.payload };
    }
    case DS_INSTANCE_URL: {
      const dsInstanceUrl = action.payload;
      return { ...state, dsInstanceUrl, calcFieldErr: '' };
    }
    case FIELD_ERR: {
      return { ...state, calcFieldErr: action.payload };
    }
    default:
      return state;
  }
};

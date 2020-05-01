import { DashboardQuery, SearchAction, SearchLayout } from '../types';
import {
  ADD_TAG,
  CLEAR_FILTERS,
  LAYOUT_CHANGE,
  QUERY_CHANGE,
  REMOVE_STARRED,
  REMOVE_TAG,
  SET_TAGS,
  TOGGLE_SORT,
  TOGGLE_STARRED,
} from './actionTypes';

export const defaultQuery: DashboardQuery = {
  query: '',
  tag: [],
  starred: false,
  skipRecent: false,
  skipStarred: false,
  folderIds: [],
  sort: null,
  layout: SearchLayout.Folders,
};

export const queryReducer = (state: DashboardQuery, action: SearchAction) => {
  switch (action.type) {
    case QUERY_CHANGE:
      return { ...state, query: action.payload };
    case REMOVE_TAG:
      return { ...state, tag: state.tag.filter(t => t !== action.payload) };
    case SET_TAGS:
      return { ...state, tag: action.payload };
    case ADD_TAG: {
      const tag = action.payload;
      return tag && !state.tag.includes(tag) ? { ...state, tag: [...state.tag, tag] } : state;
    }
    case TOGGLE_STARRED:
      return { ...state, starred: action.payload };
    case REMOVE_STARRED:
      return { ...state, starred: false };
    case CLEAR_FILTERS:
      return { ...state, query: '', tag: [], starred: false, sort: null };
    case TOGGLE_SORT: {
      const sort = action.payload;
      if (state.layout === SearchLayout.Folders) {
        return { ...state, sort, layout: SearchLayout.List };
      }
      return { ...state, sort };
    }
    case LAYOUT_CHANGE: {
      const layout = action.payload;
      if (state.sort && layout === SearchLayout.Folders) {
        return { ...state, layout, sort: null };
      }
      return { ...state, layout };
    }
    default:
      return state;
  }
};

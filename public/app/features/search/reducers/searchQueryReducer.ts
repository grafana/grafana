import { SearchAction, DashboardQuery } from '../types';
import {
  ADD_TAG,
  CLEAR_FILTERS,
  QUERY_CHANGE,
  REMOVE_STARRED,
  REMOVE_TAG,
  SET_TAGS,
  TOGGLE_STARRED,
} from './actionTypes';

export const defaultQuery: DashboardQuery = {
  query: '',
  tag: [],
  starred: false,
  skipRecent: false,
  skipStarred: false,
  folderIds: [],
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
      return { ...state, query: '', tag: [], starred: false };
    default:
      return state;
  }
};

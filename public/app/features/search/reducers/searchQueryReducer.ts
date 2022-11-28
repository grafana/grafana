import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { SelectableValue, UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { SEARCH_SELECTED_LAYOUT } from '../constants';
import { DashboardQuery, SearchLayout, SearchQueryParams } from '../types';
import { parseRouteParams } from '../utils';

export const initialState: DashboardQuery = {
  query: '',
  tag: [],
  sort: null,
  starred: false,
  layout: SearchLayout.Folders,
  prevSort: null,
};

export const defaultQueryParams: SearchQueryParams = {
  sort: null,
  starred: null,
  query: null,
  tag: null,
  layout: null,
};

const queryParams = parseRouteParams(locationService.getSearchObject());
const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT) as SearchLayout;

if (!queryParams.layout?.length && selectedLayout?.length) {
  initialState.layout = selectedLayout;
}

const searchQuerySlice = createSlice({
  name: 'searchQuery',
  initialState,
  reducers: {
    initStateFromUrl(state, action: PayloadAction<UrlQueryMap>) {
      const queryParams = parseRouteParams(action.payload);
      Object.assign(state, queryParams);
    },
    queryChange: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    removeTag: (state, action: PayloadAction<string>) => {
      state.tag = state.tag.filter((tag) => tag !== action.payload);
    },
    setTags: (state, action: PayloadAction<string[]>) => {
      state.tag = action.payload;
    },
    addTag: (state, action: PayloadAction<string>) => {
      const tag = action.payload;
      if (tag && !state.tag.includes(tag)) {
        state.tag.push(tag);
      }
    },
    datasourceChange: (state, action: PayloadAction<string | undefined>) => {
      state.datasource = action.payload;
    },
    toggleStarred: (state, action: PayloadAction<boolean>) => {
      state.starred = action.payload;
    },
    removeStarred: (state) => {
      state.starred = false;
    },
    clearFilters: (state) => {
      state.tag = [];
      state.starred = false;
      state.sort = null;
      state.query = '';
    },
    toggleSort: (state, action: PayloadAction<SelectableValue | null>) => {
      const sort = action.payload;
      if (state.layout === SearchLayout.Folders) {
        state.sort = sort;
        state.layout = SearchLayout.List;
      } else {
        state.sort = sort;
      }
    },
    layoutChange: (state, action: PayloadAction<SearchLayout>) => {
      const layout = action.payload;
      if (state.sort && layout === SearchLayout.Folders) {
        state.layout = layout;
        state.prevSort = state.sort;
        state.sort = null;
      } else {
        state.layout = layout;
        state.sort = state.prevSort;
      }
    },
  },
});

export const {
  queryChange,
  removeTag,
  setTags,
  addTag,
  datasourceChange,
  toggleStarred,
  removeStarred,
  clearFilters,
  toggleSort,
  layoutChange,
  initStateFromUrl,
} = searchQuerySlice.actions;
export const searchQueryReducer = searchQuerySlice.reducer;

export default {
  searchQuery: searchQueryReducer,
};

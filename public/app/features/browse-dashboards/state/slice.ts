import { createSlice } from '@reduxjs/toolkit';

import { BrowseDashboardsState } from '../types';

import { fetchChildren } from './actions';
import * as allReducers from './reducers';

const { extraReducerFetchChildrenFulfilled, ...baseReducers } = allReducers;

const initialState: BrowseDashboardsState = {
  rootItems: [],
  childrenByParentUID: {},
  openFolders: {},
  selectedItems: {
    dashboard: {},
    folder: {},
    panel: {},
  },
};

const browseDashboardsSlice = createSlice({
  name: 'browseDashboards',
  initialState,
  reducers: baseReducers,

  extraReducers: (builder) => {
    builder.addCase(fetchChildren.fulfilled, extraReducerFetchChildrenFulfilled);
  },
});

export const browseDashboardsReducer = browseDashboardsSlice.reducer;

export const { setFolderOpenState, setItemSelectionState } = browseDashboardsSlice.actions;

export default {
  browseDashboards: browseDashboardsReducer,
};

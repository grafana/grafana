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
    dashboard: {
      'ad5eb449-330a-414b-ab23-8508811aaa53': true,
    },
    folder: {
      'c6a3b0e9-7bad-4c5c-9026-e079cbb79888': true,
    },
    panel: {},
    $all: false,
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

export const { setFolderOpenState, setItemSelectionState, setAllSelection } = browseDashboardsSlice.actions;

export default {
  browseDashboards: browseDashboardsReducer,
};

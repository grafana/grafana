import { createSlice } from '@reduxjs/toolkit';

import { type BrowseDashboardsState } from '../types';

import { fetchFolderEditAccess, fetchNextChildrenPage, refetchChildren } from './actions';
import * as allReducers from './reducers';

const { fetchNextChildrenPageFulfilled, refetchChildrenFulfilled, fetchFolderEditAccessFulfilled, ...baseReducers } =
  allReducers;

const initialState: BrowseDashboardsState = {
  rootItems: undefined,
  childrenByParentUID: {},
  openFolders: {},
  folderEditAccess: {},
  selectedItems: {
    dashboard: {},
    folder: {},
    panel: {},
    $all: false,
  },
};

const browseDashboardsSlice = createSlice({
  name: 'browseDashboards',
  initialState,
  reducers: baseReducers,

  extraReducers: (builder) => {
    builder.addCase(fetchNextChildrenPage.fulfilled, fetchNextChildrenPageFulfilled);
    builder.addCase(refetchChildren.fulfilled, refetchChildrenFulfilled);
    builder.addCase(fetchFolderEditAccess.fulfilled, fetchFolderEditAccessFulfilled);
  },
});

export const browseDashboardsReducer = browseDashboardsSlice.reducer;

export const { setFolderOpenState, setItemSelectionState, setAllSelection, clearFolders } =
  browseDashboardsSlice.actions;

export default {
  browseDashboards: browseDashboardsReducer,
};

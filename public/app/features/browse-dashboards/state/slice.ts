import { createSlice } from '@reduxjs/toolkit';

import { BrowseDashboardsState } from '../types';

import { fetchNextChildrenPage, refetchChildren } from './actions';
import * as allReducers from './reducers';

const { fetchNextChildrenPageFulfilled, refetchChildrenFulfilled, ...baseReducers } = allReducers;

const initialState: BrowseDashboardsState = {
  rootItems: undefined,
  childrenByParentUID: {},
  openFolders: {},
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
  },
});

export const browseDashboardsReducer = browseDashboardsSlice.reducer;

export const { setFolderOpenState, setItemSelectionState, setAllSelection } = browseDashboardsSlice.actions;

export default {
  browseDashboards: browseDashboardsReducer,
};

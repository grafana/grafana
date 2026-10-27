import { createSlice } from '@reduxjs/toolkit';

import { type BrowseDashboardsState } from '../types';

import { applyRefreshPlan, fetchNextChildrenPage, refetchChildren, refreshTree } from './actions';
import * as allReducers from './reducers';

const {
  fetchNextChildrenPageFulfilled,
  refetchChildrenPending,
  refetchChildrenFulfilled,
  refreshPlanApplied,
  refreshTreeFulfilled,
  ...baseReducers
} = allReducers;

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
    builder.addCase(refetchChildren.pending, refetchChildrenPending);
    builder.addCase(refetchChildren.fulfilled, refetchChildrenFulfilled);
    builder.addCase(applyRefreshPlan, refreshPlanApplied);
    builder.addCase(refreshTree.fulfilled, refreshTreeFulfilled);
  },
});

export const browseDashboardsReducer = browseDashboardsSlice.reducer;

export const { setFolderOpenState, setItemSelectionState, setAllSelection, clearFolders, setRepositorySyncedAt } =
  browseDashboardsSlice.actions;

export default {
  browseDashboards: browseDashboardsReducer,
};

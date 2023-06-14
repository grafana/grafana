import { createSlice } from '@reduxjs/toolkit';

import { endpoints } from '../api/browseDashboardsAPI';
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
    builder.addMatcher(endpoints.getFolderChildren.matchFulfilled, (state, action) => {
      const parentUID = action.meta.arg.originalArgs;
      const children = action.payload;

      state.childrenByParentUID[parentUID] = {
        lastFetchedKind: 'dashboard',
        lastFetchedPage: 1,
        lastKindHasMoreItems: false,
        isFullyLoaded: true,
        items: children,
      };

      // If the parent of the items we've loaded are selected, we must select all these items also
      const parentIsSelected = state.selectedItems.folder[parentUID];
      if (parentIsSelected) {
        for (const child of children) {
          state.selectedItems[child.kind][child.uid] = true;
        }
      }
    });
  },
});

export const browseDashboardsReducer = browseDashboardsSlice.reducer;

export const { setFolderOpenState, setItemSelectionState, setAllSelection } = browseDashboardsSlice.actions;

export default {
  browseDashboards: browseDashboardsReducer,
};

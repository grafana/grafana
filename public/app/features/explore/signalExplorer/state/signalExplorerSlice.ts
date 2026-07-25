import { createSlice, type PayloadAction, type UnknownAction } from '@reduxjs/toolkit';

import type { MetricType } from '../types';

// Explore's own pane-removal actions, matched as literals. `explore/state/main.ts` imports this
// slice to register it, so importing `splitClose`/`clearPanes` back from it would be a require
// cycle. `signalExplorerSlice.test.ts` asserts these strings still equal the real action types.
const SPLIT_CLOSE_TYPE = 'explore/splitClose';
const CLEAR_PANES_TYPE = 'explore/clearPanes';

export interface PaneViewState {
  activeRefId?: string;
  selectedMetric?: { refId: string; metricName: string };
  typeFilter: MetricType | null;
  searchText: string;
}

export type SignalExplorerState = Record<string, PaneViewState>;

const emptyPane = (): PaneViewState => ({ typeFilter: null, searchText: '' });
const initialState: SignalExplorerState = {};

const slice = createSlice({
  name: 'signalExplorer',
  initialState,
  reducers: {
    setActiveRefId: (state, action: PayloadAction<{ exploreId: string; refId: string }>) => {
      (state[action.payload.exploreId] ??= emptyPane()).activeRefId = action.payload.refId;
    },
    setSelectedMetric: (state, action: PayloadAction<{ exploreId: string; refId: string; metricName: string }>) => {
      (state[action.payload.exploreId] ??= emptyPane()).selectedMetric = {
        refId: action.payload.refId,
        metricName: action.payload.metricName,
      };
    },
    clearSelectedMetric: (state, action: PayloadAction<{ exploreId: string }>) => {
      const pane = state[action.payload.exploreId];
      if (pane) {
        pane.selectedMetric = undefined;
      }
    },
    setTypeFilter: (state, action: PayloadAction<{ exploreId: string; typeFilter: MetricType | null }>) => {
      (state[action.payload.exploreId] ??= emptyPane()).typeFilter = action.payload.typeFilter;
    },
    setSearchText: (state, action: PayloadAction<{ exploreId: string; searchText: string }>) => {
      (state[action.payload.exploreId] ??= emptyPane()).searchText = action.payload.searchText;
    },
    clearExploreState: (state, action: PayloadAction<{ exploreId: string }>) => {
      delete state[action.payload.exploreId];
    },
  },
  extraReducers: (builder) => {
    builder
      // A pane's view state has to die with the pane. `generateExploreId()` only checks *live*
      // panes for id collisions, so state left behind by a closed pane can be inherited by a new
      // one — which would then open pre-filtered, with a metric selected from a query that no
      // longer exists.
      .addMatcher(
        (action: UnknownAction): action is PayloadAction<string> => action.type === SPLIT_CLOSE_TYPE,
        (state, action) => {
          delete state[action.payload];
        }
      )
      .addMatcher(
        (action: UnknownAction) => action.type === CLEAR_PANES_TYPE,
        () => ({})
      );
  },
});

export const {
  setActiveRefId,
  setSelectedMetric,
  clearSelectedMetric,
  setTypeFilter,
  setSearchText,
  clearExploreState,
} = slice.actions;
export const signalExplorerReducer = slice.reducer;

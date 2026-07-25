import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { MetricType } from '../types';

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

import { type StoreState } from 'app/types/store';

import type { MetricType } from '../types';

interface PaneViewState {
  activeRefId?: string;
  selectedMetric?: { refId: string; metricName: string };
  typeFilter: MetricType | null;
  searchText: string;
}

// Stable reference for the missing-pane case: a fresh object literal per call would
// break useSelector reference equality and cause an infinite re-render loop.
const emptyPane: PaneViewState = Object.freeze({ typeFilter: null, searchText: '' });

export const selectSignalExplorerState = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  state.signalExplorer[exploreId] ?? emptyPane;

export const selectSelectedMetric = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  selectSignalExplorerState(state, exploreId).selectedMetric;

export const selectTypeFilter = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  selectSignalExplorerState(state, exploreId).typeFilter;

export const selectSearchText = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  selectSignalExplorerState(state, exploreId).searchText;

export const selectActiveRefId = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  selectSignalExplorerState(state, exploreId).activeRefId;

import { type StoreState } from 'app/types/store';

import type { CardViewState, PaneViewState } from './signalExplorerSlice';

// Stable references for the missing-pane/missing-card cases: a fresh object literal per call would
// break useSelector reference equality and cause an infinite re-render loop.
const emptyPane: PaneViewState = Object.freeze({ cards: {} });
const emptyCard: CardViewState = Object.freeze({ typeFilter: null, searchText: '' });

export const selectSignalExplorerState = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  state.signalExplorer[exploreId] ?? emptyPane;

/** One card's own filters. Untouched cards read as unfiltered rather than as absent. */
export const selectCardViewState = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string, refId: string) =>
  selectSignalExplorerState(state, exploreId).cards[refId] ?? emptyCard;

export const selectSelectedMetric = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  selectSignalExplorerState(state, exploreId).selectedMetric;

export const selectTypeFilter = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string, refId: string) =>
  selectCardViewState(state, exploreId, refId).typeFilter;

export const selectSearchText = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string, refId: string) =>
  selectCardViewState(state, exploreId, refId).searchText;

export const selectActiveRefId = (state: Pick<StoreState, 'signalExplorer'>, exploreId: string) =>
  selectSignalExplorerState(state, exploreId).activeRefId;

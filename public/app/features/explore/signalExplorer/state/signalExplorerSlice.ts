import { createSlice, type PayloadAction, type UnknownAction } from '@reduxjs/toolkit';

import type { DataQuery } from '@grafana/data';

import type { MetricType } from '../types';

// Explore's own pane- and query-mutation actions, matched as literals. `explore/state/main.ts`
// imports this slice to register it, so importing the action creators back from it would be a
// require cycle. `signalExplorerSlice.test.ts` asserts these strings still equal the real action
// types.
const SPLIT_CLOSE_TYPE = 'explore/splitClose';
const CLEAR_PANES_TYPE = 'explore/clearPanes';
const CHANGE_QUERIES_TYPE = 'explore/changeQueries';
const SET_QUERIES_TYPE = 'explore/setQueries';

/** What one card's own controls narrow, scoped to that card and nothing else in the pane. */
export interface CardViewState {
  typeFilter: MetricType | null;
  searchText: string;
}

export interface PaneViewState {
  activeRefId?: string;
  selectedMetric?: { refId: string; metricName: string };
  /**
   * Keyed by refId. A mixed pane can hold two cards on the same datasource, and each browses its own
   * catalog: one pane-wide search box would re-filter both trees from whichever one was typed in.
   */
  cards: Record<string, CardViewState>;
}

export type SignalExplorerState = Record<string, PaneViewState>;

const emptyPane = (): PaneViewState => ({ cards: {} });
const emptyCard = (): CardViewState => ({ typeFilter: null, searchText: '' });
const initialState: SignalExplorerState = {};

const cardOf = (state: SignalExplorerState, exploreId: string, refId: string): CardViewState => {
  const pane = (state[exploreId] ??= emptyPane());
  return (pane.cards[refId] ??= emptyCard());
};

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
    setTypeFilter: (
      state,
      action: PayloadAction<{ exploreId: string; refId: string; typeFilter: MetricType | null }>
    ) => {
      cardOf(state, action.payload.exploreId, action.payload.refId).typeFilter = action.payload.typeFilter;
    },
    setSearchText: (state, action: PayloadAction<{ exploreId: string; refId: string; searchText: string }>) => {
      cardOf(state, action.payload.exploreId, action.payload.refId).searchText = action.payload.searchText;
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
      )
      // View state has to die with the query it belongs to, for the same reason it dies with the
      // pane: `getNextRefId` hands out the first *unused* letter, so deleting query B and adding one
      // makes the new query B too. Left behind, it would open pre-filtered by the deleted query's
      // search text, with the metadata block describing a metric selected in a query that is gone.
      //
      // Matched here rather than exposed as a "tell the slice the queries changed" call, because a
      // host that forgets to make that call gets a bug with no symptom until a refId is recycled.
      .addMatcher(
        (action: UnknownAction): action is PayloadAction<{ exploreId: string; queries: DataQuery[] }> =>
          action.type === CHANGE_QUERIES_TYPE || action.type === SET_QUERIES_TYPE,
        (state, action) => {
          const pane = state[action.payload.exploreId];
          if (!pane) {
            return;
          }
          const live = new Set(action.payload.queries.map((query) => query.refId));
          for (const refId of Object.keys(pane.cards)) {
            if (!live.has(refId)) {
              delete pane.cards[refId];
            }
          }
          if (pane.selectedMetric && !live.has(pane.selectedMetric.refId)) {
            pane.selectedMetric = undefined;
          }
          if (pane.activeRefId && !live.has(pane.activeRefId)) {
            pane.activeRefId = undefined;
          }
        }
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

import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import { AnyAction } from 'redux';

import {
  ExploreUrlState,
  TimeRange,
  HistoryItem,
  DataSourceApi,
  ExplorePanelsState,
  PreferredVisualisationType,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { DEFAULT_RANGE, getQueryKeys } from 'app/core/utils/explore';
import { createAsyncThunk, ThunkResult } from 'app/types';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { datasourceReducer } from './datasource';
import { historyReducer } from './history';
import { richHistorySearchFiltersUpdatedAction, richHistoryUpdatedAction } from './main';
import { queryReducer, runQueries } from './query';
import { timeReducer, updateTime } from './time';
import { makeExplorePaneState, loadAndInitDatasource, createEmptyQueryResponse } from './utils';
// Types

//
// Actions and Payloads
//

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export interface ChangeSizePayload {
  exploreId: ExploreId;
  width: number;
  height: number;
}
export const changeSizeAction = createAction<ChangeSizePayload>('explore/changeSize');

/**
 * Tracks the state of explore panels that gets synced with the url.
 */
interface ChangePanelsState {
  exploreId: ExploreId;
  panelsState: ExplorePanelsState;
}
const changePanelsStateAction = createAction<ChangePanelsState>('explore/changePanels');
export function changePanelState(
  exploreId: ExploreId,
  panel: PreferredVisualisationType,
  panelState: ExplorePanelsState[PreferredVisualisationType]
): ThunkResult<void> {
  return async (dispatch, getState) => {
    const exploreItem = getState().explore.panes[exploreId];
    if (exploreItem === undefined) {
      return;
    }
    const { panelsState } = exploreItem;
    dispatch(
      changePanelsStateAction({
        exploreId,
        panelsState: {
          ...panelsState,
          [panel]: panelState,
        },
      })
    );
  };
}

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
interface InitializeExplorePayload {
  exploreId: ExploreId;
  containerWidth: number;
  queries: DataQuery[];
  range: TimeRange;
  history: HistoryItem[];
  datasourceInstance?: DataSourceApi;
}
const initializeExploreAction = createAction<InitializeExplorePayload>('explore/initializeExploreAction');

export interface SetUrlReplacedPayload {
  exploreId: ExploreId;
}
export const setUrlReplacedAction = createAction<SetUrlReplacedPayload>('explore/setUrlReplaced');

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export function changeSize(
  exploreId: ExploreId,
  { height, width }: { height: number; width: number }
): PayloadAction<ChangeSizePayload> {
  return changeSizeAction({ exploreId, height, width });
}

interface InitializeExploreOptions {
  exploreId: ExploreId;
  datasource: DataSourceRef | string;
  queries: DataQuery[];
  range: TimeRange;
  containerWidth: number;
  panelsState?: ExplorePanelsState;
  isFromCompactUrl?: boolean;
}
/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 *
 * The `datasource` param will be passed to the datasource service `get` function
 * and can be either a string that is the name or uid, or a datasourceRef
 * This is to maximize compatability with how datasources are accessed from the URL param.
 */
export const initializeExplore = createAsyncThunk(
  'explore/initializeExplore',
  async (
    { exploreId, datasource, queries, range, containerWidth, panelsState, isFromCompactUrl }: InitializeExploreOptions,
    { dispatch, getState }
  ) => {
    const exploreDatasources = getDataSourceSrv().getList();
    let instance = undefined;
    let history: HistoryItem[] = [];

    if (exploreDatasources.length >= 1) {
      const orgId = getState().user.orgId;
      const loadResult = await loadAndInitDatasource(orgId, datasource);
      instance = loadResult.instance;
      history = loadResult.history;
    }

    dispatch(
      initializeExploreAction({
        exploreId,
        containerWidth,
        queries,
        range,
        datasourceInstance: instance,
        history,
      })
    );
    if (panelsState !== undefined) {
      dispatch(changePanelsStateAction({ exploreId, panelsState }));
    }
    dispatch(updateTime({ exploreId }));

    if (instance) {
      // We do not want to add the url to browser history on init because when the pane is initialised it's because
      // we already have something in the url. Adding basically the same state as additional history item prevents
      // user to go back to previous url.
      dispatch(runQueries(exploreId));
    }
  }
);

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const paneReducer = (state: ExploreItemState = makeExplorePaneState(), action: AnyAction): ExploreItemState => {
  state = queryReducer(state, action);
  state = datasourceReducer(state, action);
  state = timeReducer(state, action);
  state = historyReducer(state, action);

  if (richHistoryUpdatedAction.match(action)) {
    const { richHistory, total } = action.payload.richHistoryResults;
    return {
      ...state,
      richHistory,
      richHistoryTotal: total,
    };
  }

  if (richHistorySearchFiltersUpdatedAction.match(action)) {
    const richHistorySearchFilters = action.payload.filters;
    return {
      ...state,
      richHistorySearchFilters,
    };
  }

  if (changeSizeAction.match(action)) {
    const containerWidth = action.payload.width;
    return { ...state, containerWidth };
  }

  if (changePanelsStateAction.match(action)) {
    const { panelsState } = action.payload;
    return { ...state, panelsState };
  }

  if (initializeExploreAction.match(action)) {
    const { containerWidth, queries, range, datasourceInstance, history } = action.payload;

    return {
      ...state,
      containerWidth,
      range,
      queries,
      initialized: true,
      queryKeys: getQueryKeys(queries),
      datasourceInstance,
      history,
      datasourceMissing: !datasourceInstance,
      queryResponse: createEmptyQueryResponse(),
      cache: [],
    };
  }

  return state;
};

/**
 * Compare 2 explore urls and return a map of what changed. Used to update the local state with all the
 * side effects needed.
 */
export const urlDiff = (
  oldUrlState: ExploreUrlState | undefined,
  currentUrlState: ExploreUrlState | undefined
): {
  datasource: boolean;
  queries: boolean;
  range: boolean;
  panelsState: boolean;
} => {
  const datasource = !isEqual(currentUrlState?.datasource, oldUrlState?.datasource);
  const queries = !isEqual(currentUrlState?.queries, oldUrlState?.queries);
  const range = !isEqual(currentUrlState?.range || DEFAULT_RANGE, oldUrlState?.range || DEFAULT_RANGE);
  const panelsState = !isEqual(currentUrlState?.panelsState, oldUrlState?.panelsState);

  return {
    datasource,
    queries,
    range,
    panelsState,
  };
};

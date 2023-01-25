import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import { AnyAction } from 'redux';

import {
  EventBusExtended,
  ExploreUrlState,
  TimeRange,
  HistoryItem,
  DataSourceApi,
  ExplorePanelsState,
  PreferredVisualisationType,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import {
  DEFAULT_RANGE,
  getQueryKeys,
  parseUrlState,
  ensureQueries,
  generateNewKeyAndAddRefIdIfMissing,
  getTimeRangeFromUrl,
} from 'app/core/utils/explore';
import { getFiscalYearStartMonth, getTimeZone } from 'app/features/profile/state/selectors';
import { ThunkResult } from 'app/types';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { datasourceReducer } from './datasource';
import { historyReducer } from './history';
import { richHistorySearchFiltersUpdatedAction, richHistoryUpdatedAction, stateSave } from './main';
import { queryReducer, runQueries, setQueriesAction } from './query';
import { timeReducer, updateTime } from './time';
import {
  makeExplorePaneState,
  loadAndInitDatasource,
  createEmptyQueryResponse,
  getUrlStateFromPaneState,
} from './utils';
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
    const exploreItem = getState().explore[exploreId];
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
    dispatch(stateSave());
  };
}

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export interface InitializeExplorePayload {
  exploreId: ExploreId;
  containerWidth: number;
  eventBridge: EventBusExtended;
  queries: DataQuery[];
  range: TimeRange;
  history: HistoryItem[];
  datasourceInstance?: DataSourceApi;
  isFromCompactUrl?: boolean;
}
export const initializeExploreAction = createAction<InitializeExplorePayload>('explore/initializeExplore');

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

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 *
 * The `datasource` param will be passed to the datasource service `get` function
 * and can be either a string that is the name or uid, or a datasourceRef
 * This is to maximize compatability with how datasources are accessed from the URL param.
 */
export function initializeExplore(
  exploreId: ExploreId,
  datasource: DataSourceRef | string,
  queries: DataQuery[],
  range: TimeRange,
  containerWidth: number,
  eventBridge: EventBusExtended,
  panelsState?: ExplorePanelsState,
  isFromCompactUrl?: boolean
): ThunkResult<void> {
  return async (dispatch, getState) => {
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
        eventBridge,
        queries,
        range,
        datasourceInstance: instance,
        history,
        isFromCompactUrl,
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
      dispatch(runQueries(exploreId, { replaceUrl: true }));
    }
  };
}

/**
 * Reacts to changes in URL state that we need to sync back to our redux state. Computes diff of newUrlQuery vs current
 * state and runs update actions for relevant parts.
 */
export function refreshExplore(exploreId: ExploreId, newUrlQuery: string): ThunkResult<void> {
  return async (dispatch, getState) => {
    const itemState = getState().explore[exploreId];
    if (!itemState?.initialized) {
      return;
    }

    // Get diff of what should be updated
    const newUrlState = parseUrlState(newUrlQuery);
    const update = urlDiff(newUrlState, getUrlStateFromPaneState(itemState));

    const { containerWidth, eventBridge } = itemState;

    // datasource will either be name or UID here
    const { datasource, queries, range: urlRange, panelsState } = newUrlState;
    const refreshQueries: DataQuery[] = [];

    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      refreshQueries.push(generateNewKeyAndAddRefIdIfMissing(query, refreshQueries, index));
    }

    const timeZone = getTimeZone(getState().user);
    const fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);
    const range = getTimeRangeFromUrl(urlRange, timeZone, fiscalYearStartMonth);

    // commit changes based on the diff of new url vs old url

    if (update.datasource) {
      const initialQueries = await ensureQueries(queries);
      await dispatch(
        initializeExplore(exploreId, datasource, initialQueries, range, containerWidth, eventBridge, panelsState)
      );
      return;
    }

    if (update.range) {
      dispatch(updateTime({ exploreId, rawRange: range.raw }));
    }

    if (update.queries) {
      dispatch(setQueriesAction({ exploreId, queries: refreshQueries }));
    }

    if (update.panelsState && panelsState !== undefined) {
      dispatch(changePanelsStateAction({ exploreId, panelsState }));
    }

    // always run queries when refresh is needed
    if (update.queries || update.range) {
      dispatch(runQueries(exploreId));
    }
  };
}

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
    const { containerWidth, eventBridge, queries, range, datasourceInstance, history, isFromCompactUrl } =
      action.payload;

    return {
      ...state,
      containerWidth,
      eventBridge,
      range,
      queries,
      initialized: true,
      queryKeys: getQueryKeys(queries),
      datasourceInstance,
      history,
      datasourceMissing: !datasourceInstance,
      queryResponse: createEmptyQueryResponse(),
      cache: [],
      isFromCompactUrl: isFromCompactUrl || false,
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

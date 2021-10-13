import { AnyAction } from 'redux';
import { isEqual } from 'lodash';

import {
  DEFAULT_RANGE,
  getQueryKeys,
  parseUrlState,
  ensureQueries,
  generateNewKeyAndAddRefIdIfMissing,
  getTimeRangeFromUrl,
} from 'app/core/utils/explore';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { queryReducer, runQueries, setQueriesAction } from './query';
import { datasourceReducer } from './datasource';
import { timeReducer, updateTime } from './time';
import { historyReducer } from './history';
import {
  makeExplorePaneState,
  loadAndInitDatasource,
  createEmptyQueryResponse,
  getUrlStateFromPaneState,
  storeGraphStyle,
} from './utils';
import { createAction, PayloadAction } from '@reduxjs/toolkit';
import {
  EventBusExtended,
  DataQuery,
  ExploreUrlState,
  TimeRange,
  HistoryItem,
  DataSourceApi,
  ExploreGraphStyle,
} from '@grafana/data';
// Types
import { ThunkResult } from 'app/types';
import { getFiscalYearStartMonth, getTimeZone } from 'app/features/profile/state/selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { getRichHistory } from '../../../core/utils/richHistory';
import { richHistoryUpdatedAction, stateSave } from './main';

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
  originPanelId?: number | null;
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

interface ChangeGraphStylePayload {
  exploreId: ExploreId;
  graphStyle: ExploreGraphStyle;
}

const changeGraphStyleAction = createAction<ChangeGraphStylePayload>('explore/changeGraphStyle');

export function changeGraphStyle(exploreId: ExploreId, graphStyle: ExploreGraphStyle): ThunkResult<void> {
  return async (dispatch, getState) => {
    storeGraphStyle(graphStyle);
    dispatch(changeGraphStyleAction({ exploreId, graphStyle }));
    dispatch(stateSave());
  };
}

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export function initializeExplore(
  exploreId: ExploreId,
  datasourceNameOrUid: string,
  queries: DataQuery[],
  range: TimeRange,
  containerWidth: number,
  eventBridge: EventBusExtended,
  graphStyle: ExploreGraphStyle | undefined,
  originPanelId?: number | null
): ThunkResult<void> {
  return async (dispatch, getState) => {
    const exploreDatasources = getDataSourceSrv().getList();
    let instance = undefined;
    let history: HistoryItem[] = [];

    if (exploreDatasources.length >= 1) {
      const orgId = getState().user.orgId;
      const loadResult = await loadAndInitDatasource(orgId, datasourceNameOrUid);
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
        originPanelId,
        datasourceInstance: instance,
        history,
      })
    );
    if (graphStyle !== undefined) {
      // if graphStyle is undefined, we let it be at the initial-value (which was taken from local-storage)
      dispatch(changeGraphStyleAction({ exploreId, graphStyle }));
    }
    dispatch(updateTime({ exploreId }));

    if (instance) {
      // We do not want to add the url to browser history on init because when the pane is initialised it's because
      // we already have something in the url. Adding basically the same state as additional history item prevents
      // user to go back to previous url.
      dispatch(runQueries(exploreId, { replaceUrl: true }));
    }

    const richHistory = getRichHistory();
    dispatch(richHistoryUpdatedAction({ richHistory }));
  };
}

/**
 * Reacts to changes in URL state that we need to sync back to our redux state. Computes diff of newUrlQuery vs current
 * state and runs update actions for relevant parts.
 */
export function refreshExplore(exploreId: ExploreId, newUrlQuery: string): ThunkResult<void> {
  return async (dispatch, getState) => {
    const itemState = getState().explore[exploreId]!;
    if (!itemState.initialized) {
      return;
    }

    // Get diff of what should be updated
    const newUrlState = parseUrlState(newUrlQuery);
    const update = urlDiff(newUrlState, getUrlStateFromPaneState(itemState));

    const { containerWidth, eventBridge } = itemState;

    const { datasource, queries, range: urlRange, originPanelId, graphStyle } = newUrlState;
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
      const initialQueries = ensureQueries(queries);
      await dispatch(
        initializeExplore(
          exploreId,
          datasource,
          initialQueries,
          range,
          containerWidth,
          eventBridge,
          graphStyle,
          originPanelId
        )
      );
      return;
    }

    if (update.range) {
      dispatch(updateTime({ exploreId, rawRange: range.raw }));
    }

    if (update.queries) {
      dispatch(setQueriesAction({ exploreId, queries: refreshQueries }));
    }

    if (update.graphStyle && graphStyle !== undefined) {
      dispatch(changeGraphStyleAction({ exploreId, graphStyle }));
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

  if (changeSizeAction.match(action)) {
    const containerWidth = action.payload.width;
    return { ...state, containerWidth };
  }

  if (changeGraphStyleAction.match(action)) {
    const { graphStyle } = action.payload;
    return { ...state, graphStyle };
  }

  if (initializeExploreAction.match(action)) {
    const { containerWidth, eventBridge, queries, range, originPanelId, datasourceInstance, history } = action.payload;

    return {
      ...state,
      containerWidth,
      eventBridge,
      range,
      queries,
      initialized: true,
      queryKeys: getQueryKeys(queries, datasourceInstance),
      originPanelId,
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
  graphStyle: boolean;
} => {
  const datasource = !isEqual(currentUrlState?.datasource, oldUrlState?.datasource);
  const queries = !isEqual(currentUrlState?.queries, oldUrlState?.queries);
  const range = !isEqual(currentUrlState?.range || DEFAULT_RANGE, oldUrlState?.range || DEFAULT_RANGE);
  const graphStyle = currentUrlState?.graphStyle !== oldUrlState?.graphStyle;

  return {
    datasource,
    queries,
    range,
    graphStyle,
  };
};

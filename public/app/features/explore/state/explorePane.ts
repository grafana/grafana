import { createAction, PayloadAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import {
  TimeRange,
  HistoryItem,
  DataSourceApi,
  ExplorePanelsState,
  PreferredVisualisationType,
  RawTimeRange,
} from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { getQueryKeys } from 'app/core/utils/explore';
import { CorrelationData } from 'app/features/correlations/useCorrelations';
import { getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { createAsyncThunk, ThunkResult } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import { datasourceReducer } from './datasource';
import { historyReducer } from './history';
import { richHistorySearchFiltersUpdatedAction, richHistoryUpdatedAction } from './main';
import { queryReducer, runQueries } from './query';
import { timeReducer, updateTime } from './time';
import {
  makeExplorePaneState,
  loadAndInitDatasource,
  createEmptyQueryResponse,
  getRange,
  getDatasourceUIDs,
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
  exploreId: string;
  width: number;
}
export const changeSizeAction = createAction<ChangeSizePayload>('explore/changeSize');

/**
 * Tracks the state of explore panels that gets synced with the url.
 */
interface ChangePanelsState {
  exploreId: string;
  panelsState: ExplorePanelsState;
}
const changePanelsStateAction = createAction<ChangePanelsState>('explore/changePanels');
export function changePanelState(
  exploreId: string,
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
  exploreId: string;
  queries: DataQuery[];
  range: TimeRange;
  history: HistoryItem[];
  datasourceInstance?: DataSourceApi;
}
const initializeExploreAction = createAction<InitializeExplorePayload>('explore/initializeExploreAction');

export interface SetUrlReplacedPayload {
  exploreId: string;
}
export const setUrlReplacedAction = createAction<SetUrlReplacedPayload>('explore/setUrlReplaced');

export interface SaveCorrelationsPayload {
  exploreId: string;
  correlations: CorrelationData[];
}
export const saveCorrelationsAction = createAction<SaveCorrelationsPayload>('explore/saveCorrelationsAction');

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export function changeSize(exploreId: string, { width }: { width: number }): PayloadAction<ChangeSizePayload> {
  return changeSizeAction({ exploreId, width });
}

export interface InitializeExploreOptions {
  exploreId: string;
  datasource: DataSourceRef | string | undefined;
  queries: DataQuery[];
  range: RawTimeRange;
  panelsState?: ExplorePanelsState;
  position?: number;
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
    { exploreId, datasource, queries, range, panelsState }: InitializeExploreOptions,
    { dispatch, getState, fulfillWithValue }
  ) => {
    let instance = undefined;
    let history: HistoryItem[] = [];

    if (datasource) {
      const orgId = getState().user.orgId;
      const loadResult = await loadAndInitDatasource(orgId, datasource);
      instance = loadResult.instance;
      history = loadResult.history;
    }

    dispatch(
      initializeExploreAction({
        exploreId,
        queries,
        range: getRange(range, getTimeZone(getState().user)),
        datasourceInstance: instance,
        history,
      })
    );
    if (panelsState !== undefined) {
      dispatch(changePanelsStateAction({ exploreId, panelsState }));
    }
    dispatch(updateTime({ exploreId }));

    if (instance) {
      const datasourceUIDs = getDatasourceUIDs(instance.uid, queries);
      const correlations = await getCorrelationsBySourceUIDs(datasourceUIDs);
      dispatch(saveCorrelationsAction({ exploreId: exploreId, correlations: correlations.correlations || [] }));

      dispatch(runQueries({ exploreId }));
    }

    return fulfillWithValue({ exploreId, state: getState().explore.panes[exploreId]! });
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

  if (saveCorrelationsAction.match(action)) {
    return {
      ...state,
      correlations: action.payload.correlations,
    };
  }

  if (initializeExploreAction.match(action)) {
    const { queries, range, datasourceInstance, history } = action.payload;

    return {
      ...state,
      range,
      queries,
      initialized: true,
      queryKeys: getQueryKeys(queries),
      datasourceInstance,
      history,
      queryResponse: createEmptyQueryResponse(),
      cache: [],
      correlations: [],
    };
  }

  return state;
};

// Libraries
import { AnyAction, createAction, PayloadAction } from '@reduxjs/toolkit';
import { RefreshPicker } from '@grafana/ui';
import { DataSourceApi, HistoryItem } from '@grafana/data';
import store from 'app/core/store';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { lastUsedDatasourceKeyForOrgId, stopQueryState } from 'app/core/utils/explore';
import { ExploreItemState, ThunkResult } from 'app/types';

import { ExploreId } from 'app/types/explore';
import { getExploreDatasources } from './selectors';
import { importQueries, runQueries } from './query';
import { changeRefreshInterval } from './time';
import { createEmptyQueryResponse, makeInitialUpdateState } from './utils';

//
// Actions and Payloads
//

/**
 * Display an error when no datasources have been configured
 */
export interface LoadDatasourceMissingPayload {
  exploreId: ExploreId;
}
export const loadDatasourceMissingAction = createAction<LoadDatasourceMissingPayload>('explore/loadDatasourceMissing');

/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export interface LoadDatasourcePendingPayload {
  exploreId: ExploreId;
  requestedDatasourceName: string;
}
export const loadDatasourcePendingAction = createAction<LoadDatasourcePendingPayload>('explore/loadDatasourcePending');

/**
 * Datasource loading was completed.
 */
export interface LoadDatasourceReadyPayload {
  exploreId: ExploreId;
  history: HistoryItem[];
}
export const loadDatasourceReadyAction = createAction<LoadDatasourceReadyPayload>('explore/loadDatasourceReady');

/**
 * Updates datasource instance before datasource loading has started
 */
export interface UpdateDatasourceInstancePayload {
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
}
export const updateDatasourceInstanceAction = createAction<UpdateDatasourceInstancePayload>(
  'explore/updateDatasourceInstance'
);

//
// Action creators
//

/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(
  exploreId: ExploreId,
  datasourceName: string,
  options?: { importQueries: boolean }
): ThunkResult<void> {
  return async (dispatch, getState) => {
    let newDataSourceInstance: DataSourceApi;

    if (!datasourceName) {
      newDataSourceInstance = await getDatasourceSrv().get();
    } else {
      newDataSourceInstance = await getDatasourceSrv().get(datasourceName);
    }

    const currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
    const queries = getState().explore[exploreId].queries;
    const orgId = getState().user.orgId;

    dispatch(
      updateDatasourceInstanceAction({
        exploreId,
        datasourceInstance: newDataSourceInstance,
      })
    );

    if (options?.importQueries) {
      await dispatch(importQueries(exploreId, queries, currentDataSourceInstance, newDataSourceInstance));
    }

    if (getState().explore[exploreId].isLive) {
      dispatch(changeRefreshInterval(exploreId, RefreshPicker.offOption.value));
    }

    await dispatch(loadDatasource(exploreId, newDataSourceInstance, orgId));

    // Exception - we only want to run queries on data source change, if the queries were imported
    if (options?.importQueries) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Loads all explore data sources and sets the chosen datasource.
 * If there are no datasources a missing datasource action is dispatched.
 */
export function loadExploreDatasourcesAndSetDatasource(
  exploreId: ExploreId,
  datasourceName: string
): ThunkResult<void> {
  return async dispatch => {
    const exploreDatasources = getExploreDatasources();

    if (exploreDatasources.length >= 1) {
      await dispatch(changeDatasource(exploreId, datasourceName, { importQueries: true }));
    } else {
      dispatch(loadDatasourceMissingAction({ exploreId }));
    }
  };
}

/**
 * Datasource loading was successfully completed.
 */
export const loadDatasourceReady = (
  exploreId: ExploreId,
  instance: DataSourceApi,
  orgId: number
): PayloadAction<LoadDatasourceReadyPayload> => {
  const historyKey = `grafana.explore.history.${instance.meta?.id}`;
  const history = store.getObject(historyKey, []);
  // Save last-used datasource

  store.set(lastUsedDatasourceKeyForOrgId(orgId), instance.name);

  return loadDatasourceReadyAction({
    exploreId,
    history,
  });
};

/**
 * Main action to asynchronously load a datasource. Dispatches lots of smaller actions for feedback.
 */
export const loadDatasource = (exploreId: ExploreId, instance: DataSourceApi, orgId: number): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const datasourceName = instance.name;

    // Keep ID to track selection
    dispatch(loadDatasourcePendingAction({ exploreId, requestedDatasourceName: datasourceName }));

    if (instance.init) {
      try {
        instance.init();
      } catch (err) {
        console.error(err);
      }
    }

    if (datasourceName !== getState().explore[exploreId].requestedDatasourceName) {
      // User already changed datasource, discard results
      return;
    }

    dispatch(loadDatasourceReady(exploreId, instance, orgId));
  };
};

//
// Reducer
//

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const datasourceReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (updateDatasourceInstanceAction.match(action)) {
    const { datasourceInstance } = action.payload;

    // Custom components
    stopQueryState(state.querySubscription);

    return {
      ...state,
      datasourceInstance,
      graphResult: null,
      tableResult: null,
      logsResult: null,
      latency: 0,
      queryResponse: createEmptyQueryResponse(),
      loading: false,
      queryKeys: [],
      originPanelId: state.urlState && state.urlState.originPanelId,
    };
  }

  if (loadDatasourceMissingAction.match(action)) {
    return {
      ...state,
      datasourceMissing: true,
      datasourceLoading: false,
      update: makeInitialUpdateState(),
    };
  }

  if (loadDatasourcePendingAction.match(action)) {
    return {
      ...state,
      datasourceLoading: true,
      requestedDatasourceName: action.payload.requestedDatasourceName,
    };
  }

  if (loadDatasourceReadyAction.match(action)) {
    const { history } = action.payload;
    return {
      ...state,
      history,
      datasourceLoading: false,
      datasourceMissing: false,
      logsHighlighterExpressions: undefined,
      update: makeInitialUpdateState(),
    };
  }

  return state;
};

// Libraries
import { AnyAction, createAction } from '@reduxjs/toolkit';

import { DataSourceApi, HistoryItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import { stopQueryState } from 'app/core/utils/explore';
import { ExploreItemState, ThunkResult } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { importQueries, runQueries } from './query';
import { changeRefreshInterval } from './time';
import { createEmptyQueryResponse, loadAndInitDatasource } from './utils';

//
// Actions and Payloads
//

/**
 * Updates datasource instance before datasource loading has started
 */
export interface UpdateDatasourceInstancePayload {
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
  history: HistoryItem[];
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
  datasourceUid: string,
  options?: { importQueries: boolean }
): ThunkResult<void> {
  return async (dispatch, getState) => {
    const orgId = getState().user.orgId;
    const { history, instance } = await loadAndInitDatasource(orgId, { uid: datasourceUid });
    const currentDataSourceInstance = getState().explore[exploreId]!.datasourceInstance;

    reportInteraction('explore_change_ds', {
      from: (currentDataSourceInstance?.meta?.mixed ? 'mixed' : currentDataSourceInstance?.type) || 'unknown',
      to: instance.meta.mixed ? 'mixed' : instance.type,
      exploreId,
    });
    dispatch(
      updateDatasourceInstanceAction({
        exploreId,
        datasourceInstance: instance,
        history,
      })
    );

    if (options?.importQueries) {
      const queries = getState().explore[exploreId]!.queries;
      await dispatch(importQueries(exploreId, queries, currentDataSourceInstance, instance));
    }

    if (getState().explore[exploreId]!.isLive) {
      dispatch(changeRefreshInterval(exploreId, RefreshPicker.offOption.value));
    }

    // Exception - we only want to run queries on data source change, if the queries were imported
    if (options?.importQueries) {
      dispatch(runQueries(exploreId));
    }
  };
}

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
    const { datasourceInstance, history } = action.payload;

    // Custom components
    stopQueryState(state.querySubscription);

    return {
      ...state,
      datasourceInstance,
      graphResult: null,
      tableResult: null,
      logsResult: null,
      logsVolumeDataProvider: undefined,
      logsVolumeData: undefined,
      queryResponse: createEmptyQueryResponse(),
      loading: false,
      queryKeys: [],
      history,
      datasourceMissing: false,
    };
  }

  return state;
};

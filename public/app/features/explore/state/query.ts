import { AnyAction, createAction, PayloadAction } from '@reduxjs/toolkit';
import deepEqual from 'fast-deep-equal';
import { flatten, groupBy } from 'lodash';
import { identity, Observable, of, SubscriptionLike, Unsubscribable, combineLatest } from 'rxjs';
import { mergeMap, throttleTime } from 'rxjs/operators';

import {
  AbsoluteTimeRange,
  DataQuery,
  DataQueryErrorType,
  DataQueryResponse,
  DataSourceApi,
  hasLogsVolumeSupport,
  hasQueryExportSupport,
  hasQueryImportSupport,
  HistoryItem,
  LoadingState,
  PanelEvents,
  QueryFixAction,
  toLegacyResponseData,
} from '@grafana/data';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import {
  buildQueryTransaction,
  ensureQueries,
  generateEmptyQuery,
  generateNewKeyAndAddRefIdIfMissing,
  getQueryKeys,
  hasNonEmptyQuery,
  stopQueryState,
  updateHistory,
} from 'app/core/utils/explore';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';
import { CorrelationData } from 'app/features/correlations/useCorrelations';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { store } from 'app/store/store';
import { ExploreItemState, ExplorePanelData, ThunkDispatch, ThunkResult } from 'app/types';
import { ExploreId, ExploreState, QueryOptions } from 'app/types/explore';

import { notifyApp } from '../../../core/actions';
import { createErrorNotification } from '../../../core/copy/appNotification';
import { runRequest } from '../../query/state/runRequest';
import { decorateData } from '../utils/decorators';

import { addHistoryItem, historyUpdatedAction, loadRichHistory } from './history';
import { stateSave } from './main';
import { updateTime } from './time';
import { createCacheKey, getResultsFromCache, storeLogsVolumeEnabled } from './utils';

//
// Actions and Payloads
//

/**
 * Adds a query row after the row with the given index.
 */
export interface AddQueryRowPayload {
  exploreId: ExploreId;
  index: number;
  query: DataQuery;
}
export const addQueryRowAction = createAction<AddQueryRowPayload>('explore/addQueryRow');

/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export interface ChangeQueriesPayload {
  exploreId: ExploreId;
  queries: DataQuery[];
}
export const changeQueriesAction = createAction<ChangeQueriesPayload>('explore/changeQueries');

/**
 * Cancel running queries.
 */
export interface CancelQueriesPayload {
  exploreId: ExploreId;
}
export const cancelQueriesAction = createAction<CancelQueriesPayload>('explore/cancelQueries');

export interface QueriesImportedPayload {
  exploreId: ExploreId;
  queries: DataQuery[];
}
export const queriesImportedAction = createAction<QueriesImportedPayload>('explore/queriesImported');

export interface QueryStoreSubscriptionPayload {
  exploreId: ExploreId;
  querySubscription: Unsubscribable;
}

export const queryStoreSubscriptionAction = createAction<QueryStoreSubscriptionPayload>(
  'explore/queryStoreSubscription'
);

const setLogsVolumeEnabledAction = createAction<{ exploreId: ExploreId; enabled: boolean }>(
  'explore/setLogsVolumeEnabledAction'
);

export interface StoreLogsVolumeDataProvider {
  exploreId: ExploreId;
  logsVolumeDataProvider?: Observable<DataQueryResponse>;
}

/**
 * Stores available logs volume provider after running the query. Used internally by runQueries().
 */
export const storeLogsVolumeDataProviderAction = createAction<StoreLogsVolumeDataProvider>(
  'explore/storeLogsVolumeDataProviderAction'
);

export const cleanLogsVolumeAction = createAction<{ exploreId: ExploreId }>('explore/cleanLogsVolumeAction');

export interface StoreLogsVolumeDataSubscriptionPayload {
  exploreId: ExploreId;
  logsVolumeDataSubscription?: SubscriptionLike;
}

/**
 * Stores current logs volume subscription for given explore pane.
 */
const storeLogsVolumeDataSubscriptionAction = createAction<StoreLogsVolumeDataSubscriptionPayload>(
  'explore/storeLogsVolumeDataSubscriptionAction'
);

/**
 * Stores data returned by the provider. Used internally by loadLogsVolumeData().
 */
const updateLogsVolumeDataAction = createAction<{
  exploreId: ExploreId;
  logsVolumeData: DataQueryResponse;
}>('explore/updateLogsVolumeDataAction');

export interface QueryEndedPayload {
  exploreId: ExploreId;
  response: ExplorePanelData;
}
export const queryStreamUpdatedAction = createAction<QueryEndedPayload>('explore/queryStreamUpdated');

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 */
export interface SetQueriesPayload {
  exploreId: ExploreId;
  queries: DataQuery[];
}
export const setQueriesAction = createAction<SetQueriesPayload>('explore/setQueries');

export interface ChangeLoadingStatePayload {
  exploreId: ExploreId;
  loadingState: LoadingState;
}
export const changeLoadingStateAction = createAction<ChangeLoadingStatePayload>('changeLoadingState');

export interface SetPausedStatePayload {
  exploreId: ExploreId;
  isPaused: boolean;
}
export const setPausedStateAction = createAction<SetPausedStatePayload>('explore/setPausedState');

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export interface ScanStartPayload {
  exploreId: ExploreId;
}
export const scanStartAction = createAction<ScanStartPayload>('explore/scanStart');

/**
 * Stop any scanning for more results.
 */
export interface ScanStopPayload {
  exploreId: ExploreId;
}
export const scanStopAction = createAction<ScanStopPayload>('explore/scanStop');

/**
 * Adds query results to cache.
 * This is currently used to cache last 5 query results for log queries run from logs navigation (pagination).
 */
export interface AddResultsToCachePayload {
  exploreId: ExploreId;
  cacheKey: string;
  queryResponse: ExplorePanelData;
}
export const addResultsToCacheAction = createAction<AddResultsToCachePayload>('explore/addResultsToCache');

/**
 *  Clears cache.
 */
export interface ClearCachePayload {
  exploreId: ExploreId;
}
export const clearCacheAction = createAction<ClearCachePayload>('explore/clearCache');

//
// Action creators
//

/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId: ExploreId, index: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    const queries = getState().explore[exploreId]!.queries;
    let datasourceOverride = undefined;

    // if this is the first query being added, check for a root datasource
    // if it's not mixed, send it as an override. generateEmptyQuery doesn't have access to state
    if (queries.length === 0) {
      const rootDatasource = getState().explore[exploreId]!.datasourceInstance;
      if (!config.featureToggles.exploreMixedDatasource || !rootDatasource?.meta.mixed) {
        datasourceOverride = rootDatasource;
      }
    }

    const query = await generateEmptyQuery(queries, index, datasourceOverride?.getRef());

    dispatch(addQueryRowAction({ exploreId, index, query }));
  };
}

/**
 * Cancel running queries
 */
export function cancelQueries(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch(scanStopAction({ exploreId }));
    dispatch(cancelQueriesAction({ exploreId }));
    dispatch(
      storeLogsVolumeDataProviderAction({
        exploreId,
        logsVolumeDataProvider: undefined,
      })
    );
    // clear any incomplete data
    if (getState().explore[exploreId]!.logsVolumeData?.state !== LoadingState.Done) {
      dispatch(cleanLogsVolumeAction({ exploreId }));
    }
    dispatch(stateSave());
  };
}

const addDatasourceToQueries = (datasource: DataSourceApi, queries: DataQuery[]) => {
  const dataSourceRef = datasource.getRef();
  return queries.map((query: DataQuery) => {
    return { ...query, datasource: dataSourceRef };
  });
};

const getImportableQueries = async (
  targetDataSource: DataSourceApi,
  sourceDataSource: DataSourceApi,
  queries: DataQuery[]
): Promise<DataQuery[]> => {
  let queriesOut: DataQuery[] = [];
  if (sourceDataSource.meta?.id === targetDataSource.meta?.id) {
    queriesOut = queries;
  } else if (hasQueryExportSupport(sourceDataSource) && hasQueryImportSupport(targetDataSource)) {
    const abstractQueries = await sourceDataSource.exportToAbstractQueries(queries);
    queriesOut = await targetDataSource.importFromAbstractQueries(abstractQueries);
  } else if (targetDataSource.importQueries) {
    // Datasource-specific importers
    queriesOut = await targetDataSource.importQueries(queries, sourceDataSource);
  }
  // add new datasource to queries before returning
  return addDatasourceToQueries(targetDataSource, queriesOut);
};

/**
 * Import queries from previous datasource if possible eg Loki and Prometheus have similar query language so the
 * labels part can be reused to get similar data.
 * @param exploreId
 * @param queries
 * @param sourceDataSource
 * @param targetDataSource
 */
export const importQueries = (
  exploreId: ExploreId,
  queries: DataQuery[],
  sourceDataSource: DataSourceApi | undefined | null,
  targetDataSource: DataSourceApi,
  singleQueryChangeRef?: string // when changing one query DS to another in a mixed environment, we do not want to change all queries, just the one being changed
): ThunkResult<void> => {
  return async (dispatch) => {
    if (!sourceDataSource) {
      // explore not initialized
      dispatch(queriesImportedAction({ exploreId, queries }));
      return;
    }

    let importedQueries = queries;
    // If going to mixed, keep queries with source datasource
    if (targetDataSource.uid === MIXED_DATASOURCE_NAME) {
      importedQueries = queries.map((query) => {
        return { ...query, datasource: sourceDataSource.getRef() };
      });
    }
    // If going from mixed, see what queries you keep by their individual datasources
    else if (sourceDataSource.uid === MIXED_DATASOURCE_NAME) {
      const groupedQueries = groupBy(queries, (query) => query.datasource?.uid);
      const groupedImportableQueries = await Promise.all(
        Object.keys(groupedQueries).map(async (key: string) => {
          const queryDatasource = await getDataSourceSrv().get({ uid: key });
          return await getImportableQueries(targetDataSource, queryDatasource, groupedQueries[key]);
        })
      );
      importedQueries = flatten(groupedImportableQueries.filter((arr) => arr.length > 0));
    } else {
      let queriesStartArr = queries;
      if (singleQueryChangeRef !== undefined) {
        const changedQuery = queries.find((query) => query.refId === singleQueryChangeRef);
        if (changedQuery) {
          queriesStartArr = [changedQuery];
        }
      }
      importedQueries = await getImportableQueries(targetDataSource, sourceDataSource, queriesStartArr);
    }

    // this will be the entire imported set, or the single imported query in an array
    let nextQueries = await ensureQueries(importedQueries, targetDataSource.getRef());

    if (singleQueryChangeRef !== undefined) {
      // if the query import didn't return a result, there was no ability to import between datasources. Create an empty query for the datasource
      if (importedQueries.length === 0) {
        const dsQuery = await generateEmptyQuery([], undefined, targetDataSource.getRef());
        importedQueries = [dsQuery];
      }

      // capture the single imported query, and copy the original set
      const updatedQueryIdx = queries.findIndex((query) => query.refId === singleQueryChangeRef);
      // for single query change, all areas that generate refId do not know about other queries, so just copy the existing refID to the new query
      const changedQuery = { ...nextQueries[0], refId: queries[updatedQueryIdx].refId };
      nextQueries = [...queries];

      // replace the changed query
      nextQueries[updatedQueryIdx] = changedQuery;
    }

    dispatch(queriesImportedAction({ exploreId, queries: nextQueries }));
  };
};

/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export function modifyQueries(
  exploreId: ExploreId,
  modification: QueryFixAction,
  modifier: (query: DataQuery, modification: QueryFixAction) => Promise<DataQuery>
): ThunkResult<void> {
  return async (dispatch, getState) => {
    const state = getState().explore[exploreId]!;

    const { queries } = state;

    const nextQueriesRaw = await Promise.all(queries.map((query) => modifier({ ...query }, modification)));

    const nextQueries = nextQueriesRaw.map((nextQuery, i) => {
      return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries, i);
    });

    dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
    if (!modification.preventSubmit) {
      dispatch(runQueries(exploreId));
    }
  };
}

async function handleHistory(
  dispatch: ThunkDispatch,
  state: ExploreState,
  history: Array<HistoryItem<DataQuery>>,
  datasource: DataSourceApi,
  queries: DataQuery[],
  exploreId: ExploreId
) {
  const datasourceId = datasource.meta.id;
  const nextHistory = updateHistory(history, datasourceId, queries);
  dispatch(historyUpdatedAction({ exploreId, history: nextHistory }));

  dispatch(addHistoryItem(datasource.uid, datasource.name, queries));

  // Because filtering happens in the backend we cannot add a new entry without checking if it matches currently
  // used filters. Instead, we refresh the query history list.
  // TODO: run only if Query History list is opened (#47252)
  await dispatch(loadRichHistory(ExploreId.left));
  await dispatch(loadRichHistory(ExploreId.right));
}

/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export const runQueries = (
  exploreId: ExploreId,
  options?: { replaceUrl?: boolean; preserveCache?: boolean }
): ThunkResult<void> => {
  return (dispatch, getState) => {
    dispatch(updateTime({ exploreId }));

    const correlations$ = getCorrelations();

    // We always want to clear cache unless we explicitly pass preserveCache parameter
    const preserveCache = options?.preserveCache === true;
    if (!preserveCache) {
      dispatch(clearCache(exploreId));
    }

    const exploreItemState = getState().explore[exploreId]!;
    const {
      datasourceInstance,
      containerWidth,
      isLive: live,
      range,
      scanning,
      queryResponse,
      querySubscription,
      refreshInterval,
      absoluteRange,
      cache,
      logsVolumeEnabled,
    } = exploreItemState;
    let newQuerySub;

    const queries = exploreItemState.queries.map((query) => ({
      ...query,
      datasource: query.datasource || datasourceInstance?.getRef(),
    }));

    if (datasourceInstance != null) {
      handleHistory(dispatch, getState().explore, exploreItemState.history, datasourceInstance, queries, exploreId);
    }

    dispatch(stateSave({ replace: options?.replaceUrl }));

    const cachedValue = getResultsFromCache(cache, absoluteRange);

    // If we have results saved in cache, we are going to use those results instead of running queries
    if (cachedValue) {
      newQuerySub = combineLatest([of(cachedValue), correlations$])
        .pipe(
          mergeMap(([data, correlations]) =>
            decorateData(
              data,
              queryResponse,
              absoluteRange,
              refreshInterval,
              queries,
              correlations,
              datasourceInstance != null && hasLogsVolumeSupport(datasourceInstance)
            )
          )
        )
        .subscribe((data) => {
          if (!data.error) {
            dispatch(stateSave());
          }

          dispatch(queryStreamUpdatedAction({ exploreId, response: data }));
        });

      // If we don't have results saved in cache, run new queries
    } else {
      if (!hasNonEmptyQuery(queries)) {
        dispatch(stateSave({ replace: options?.replaceUrl })); // Remember to save to state and update location
        return;
      }

      if (!datasourceInstance) {
        return;
      }

      // Some datasource's query builders allow per-query interval limits,
      // but we're using the datasource interval limit for now
      const minInterval = datasourceInstance?.interval;

      stopQueryState(querySubscription);

      const queryOptions: QueryOptions = {
        minInterval,
        // maxDataPoints is used in:
        // Loki - used for logs streaming for buffer size, with undefined it falls back to datasource config if it supports that.
        // Elastic - limits the number of datapoints for the counts query and for logs it has hardcoded limit.
        // Influx - used to correctly display logs in graph
        // TODO:unification
        // maxDataPoints: mode === ExploreMode.Logs && datasourceId === 'loki' ? undefined : containerWidth,
        maxDataPoints: containerWidth,
        liveStreaming: live,
      };

      const timeZone = getTimeZone(getState().user);
      const transaction = buildQueryTransaction(exploreId, queries, queryOptions, range, scanning, timeZone);

      dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Loading }));

      newQuerySub = combineLatest([
        runRequest(datasourceInstance, transaction.request)
          // Simple throttle for live tailing, in case of > 1000 rows per interval we spend about 200ms on processing and
          // rendering. In case this is optimized this can be tweaked, but also it should be only as fast as user
          // actually can see what is happening.
          .pipe(live ? throttleTime(500) : identity),
        correlations$,
      ])
        .pipe(
          mergeMap(([data, correlations]) =>
            decorateData(
              data,
              queryResponse,
              absoluteRange,
              refreshInterval,
              queries,
              correlations,
              datasourceInstance != null && hasLogsVolumeSupport(datasourceInstance)
            )
          )
        )
        .subscribe({
          next(data) {
            if (data.logsResult !== null) {
              reportInteraction('grafana_explore_logs_result_displayed', {
                datasourceType: datasourceInstance.type,
              });
            }
            dispatch(queryStreamUpdatedAction({ exploreId, response: data }));

            // Keep scanning for results if this was the last scanning transaction
            if (getState().explore[exploreId]!.scanning) {
              if (data.state === LoadingState.Done && data.series.length === 0) {
                const range = getShiftedTimeRange(-1, getState().explore[exploreId]!.range);
                dispatch(updateTime({ exploreId, absoluteRange: range }));
                dispatch(runQueries(exploreId));
              } else {
                // We can stop scanning if we have a result
                dispatch(scanStopAction({ exploreId }));
              }
            }
          },
          error(error) {
            dispatch(notifyApp(createErrorNotification('Query processing error', error)));
            dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Error }));
            console.error(error);
          },
          complete() {
            // In case we don't get any response at all but the observable completed, make sure we stop loading state.
            // This is for cases when some queries are noop like running first query after load but we don't have any
            // actual query input.
            if (getState().explore[exploreId]!.queryResponse.state === LoadingState.Loading) {
              dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Done }));
            }
          },
        });

      if (live) {
        dispatch(
          storeLogsVolumeDataProviderAction({
            exploreId,
            logsVolumeDataProvider: undefined,
          })
        );
        dispatch(cleanLogsVolumeAction({ exploreId }));
      } else if (hasLogsVolumeSupport(datasourceInstance)) {
        // we always prepare the logsVolumeProvider,
        // but we only load it, if the logs-volume-histogram is enabled.
        // (we need to have the logsVolumeProvider always actual,
        // even when the visuals are disabled, because when the user
        // enables the visuals again, we need to load the histogram,
        // so we need the provider)
        const sourceRequest = {
          ...transaction.request,
          requestId: transaction.request.requestId + '_log_volume',
        };
        const logsVolumeDataProvider = datasourceInstance.getLogsVolumeDataProvider(sourceRequest);
        dispatch(
          storeLogsVolumeDataProviderAction({
            exploreId,
            logsVolumeDataProvider,
          })
        );
        const { logsVolumeData, absoluteRange } = getState().explore[exploreId]!;
        if (!canReuseLogsVolumeData(logsVolumeData, queries, absoluteRange)) {
          dispatch(cleanLogsVolumeAction({ exploreId }));
          if (logsVolumeEnabled) {
            dispatch(loadLogsVolumeData(exploreId));
          }
        }
      } else {
        dispatch(
          storeLogsVolumeDataProviderAction({
            exploreId,
            logsVolumeDataProvider: undefined,
          })
        );
      }
    }

    dispatch(queryStoreSubscriptionAction({ exploreId, querySubscription: newQuerySub }));
  };
};

/**
 * Checks if after changing the time range the existing data can be used to show logs volume.
 * It can happen if queries are the same and new time range is within existing data time range.
 */
function canReuseLogsVolumeData(
  logsVolumeData: DataQueryResponse | undefined,
  queries: DataQuery[],
  selectedTimeRange: AbsoluteTimeRange
): boolean {
  if (logsVolumeData && logsVolumeData.data[0]) {
    // check if queries are the same
    if (!deepEqual(logsVolumeData.data[0].meta?.custom?.targets, queries)) {
      return false;
    }
    const dataRange = logsVolumeData && logsVolumeData.data[0] && logsVolumeData.data[0].meta?.custom?.absoluteRange;
    // if selected range is within loaded logs volume
    if (dataRange && dataRange.from <= selectedTimeRange.from && selectedTimeRange.to <= dataRange.to) {
      return true;
    }
  }
  return false;
}

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId: ExploreId, rawQueries: DataQuery[]): ThunkResult<void> {
  return (dispatch, getState) => {
    // Inject react keys into query objects
    const queries = getState().explore[exploreId]!.queries;
    const nextQueries = rawQueries.map((query, index) => generateNewKeyAndAddRefIdIfMissing(query, queries, index));
    dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
    dispatch(runQueries(exploreId));
  };
}

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    // Register the scanner
    dispatch(scanStartAction({ exploreId }));
    // Scanning must trigger query run, and return the new range
    const range = getShiftedTimeRange(-1, getState().explore[exploreId]!.range);
    // Set the new range to be displayed
    dispatch(updateTime({ exploreId, absoluteRange: range }));
    dispatch(runQueries(exploreId));
  };
}

export function addResultsToCache(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    const queryResponse = getState().explore[exploreId]!.queryResponse;
    const absoluteRange = getState().explore[exploreId]!.absoluteRange;
    const cacheKey = createCacheKey(absoluteRange);

    // Save results to cache only when all results recived and loading is done
    if (queryResponse.state === LoadingState.Done) {
      dispatch(addResultsToCacheAction({ exploreId, cacheKey, queryResponse }));
    }
  };
}

export function clearCache(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch(clearCacheAction({ exploreId }));
  };
}

/**
 * Initializes loading logs volume data and stores emitted value.
 */
export function loadLogsVolumeData(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    const { logsVolumeDataProvider } = getState().explore[exploreId]!;
    if (logsVolumeDataProvider) {
      const logsVolumeDataSubscription = logsVolumeDataProvider.subscribe({
        next: (logsVolumeData: DataQueryResponse) => {
          dispatch(updateLogsVolumeDataAction({ exploreId, logsVolumeData }));
        },
      });
      dispatch(storeLogsVolumeDataSubscriptionAction({ exploreId, logsVolumeDataSubscription }));
    }
  };
}

export function setLogsVolumeEnabled(exploreId: ExploreId, enabled: boolean): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch(setLogsVolumeEnabledAction({ exploreId, enabled }));
    storeLogsVolumeEnabled(enabled);
    if (enabled) {
      dispatch(loadLogsVolumeData(exploreId));
    }
  };
}

//
// Reducer
//

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const queryReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (addQueryRowAction.match(action)) {
    const { queries } = state;
    const { index, query } = action.payload;

    // Add to queries, which will cause a new row to be rendered
    const nextQueries = [...queries.slice(0, index + 1), { ...query }, ...queries.slice(index + 1)];

    return {
      ...state,
      queries: nextQueries,
      queryKeys: getQueryKeys(nextQueries),
    };
  }

  if (changeQueriesAction.match(action)) {
    const { queries } = action.payload;

    return {
      ...state,
      queries,
    };
  }

  if (cancelQueriesAction.match(action)) {
    stopQueryState(state.querySubscription);

    return {
      ...state,
      loading: false,
    };
  }

  if (setQueriesAction.match(action)) {
    const { queries } = action.payload;
    return {
      ...state,
      queries: queries.slice(),
      queryKeys: getQueryKeys(queries),
    };
  }

  if (queryStoreSubscriptionAction.match(action)) {
    const { querySubscription } = action.payload;
    return {
      ...state,
      querySubscription,
    };
  }

  if (setLogsVolumeEnabledAction.match(action)) {
    const { enabled } = action.payload;
    if (!enabled && state.logsVolumeDataSubscription) {
      state.logsVolumeDataSubscription.unsubscribe();
    }
    return {
      ...state,
      logsVolumeEnabled: enabled,
      // NOTE: the dataProvider is not cleared, we may need it later,
      // if the user re-enables the histogram-visualization
      logsVolumeData: undefined,
    };
  }

  if (storeLogsVolumeDataProviderAction.match(action)) {
    let { logsVolumeDataProvider } = action.payload;
    if (state.logsVolumeDataSubscription) {
      state.logsVolumeDataSubscription.unsubscribe();
    }
    return {
      ...state,
      logsVolumeDataProvider,
      logsVolumeDataSubscription: undefined,
    };
  }

  if (cleanLogsVolumeAction.match(action)) {
    return {
      ...state,
      logsVolumeData: undefined,
    };
  }

  if (storeLogsVolumeDataSubscriptionAction.match(action)) {
    const { logsVolumeDataSubscription } = action.payload;
    return {
      ...state,
      logsVolumeDataSubscription,
    };
  }

  if (updateLogsVolumeDataAction.match(action)) {
    let { logsVolumeData } = action.payload;

    return {
      ...state,
      logsVolumeData,
    };
  }

  if (queryStreamUpdatedAction.match(action)) {
    return processQueryResponse(state, action);
  }

  if (queriesImportedAction.match(action)) {
    const { queries } = action.payload;
    return {
      ...state,
      queries,
      queryKeys: getQueryKeys(queries),
    };
  }

  if (changeLoadingStateAction.match(action)) {
    const { loadingState } = action.payload;
    return {
      ...state,
      queryResponse: {
        ...state.queryResponse,
        state: loadingState,
      },
      loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming,
    };
  }

  if (setPausedStateAction.match(action)) {
    const { isPaused } = action.payload;
    return {
      ...state,
      isPaused: isPaused,
    };
  }

  if (scanStartAction.match(action)) {
    return { ...state, scanning: true };
  }

  if (scanStopAction.match(action)) {
    return {
      ...state,
      scanning: false,
      scanRange: undefined,
    };
  }

  if (addResultsToCacheAction.match(action)) {
    const CACHE_LIMIT = 5;
    const { cache } = state;
    const { queryResponse, cacheKey } = action.payload;

    let newCache = [...cache];
    const isDuplicateKey = newCache.some((c) => c.key === cacheKey);

    if (!isDuplicateKey) {
      const newCacheItem = { key: cacheKey, value: queryResponse };
      newCache = [newCacheItem, ...newCache].slice(0, CACHE_LIMIT);
    }

    return {
      ...state,
      cache: newCache,
    };
  }

  if (clearCacheAction.match(action)) {
    return {
      ...state,
      cache: [],
    };
  }

  return state;
};

/**
 * Creates an observable that emits correlations once they are loaded
 */
const getCorrelations = () => {
  return new Observable<CorrelationData[]>((subscriber) => {
    const existingCorrelations = store.getState().explore.correlations;
    if (existingCorrelations) {
      subscriber.next(existingCorrelations);
      subscriber.complete();
    } else {
      const unsubscribe = store.subscribe(() => {
        const { correlations } = store.getState().explore;
        if (correlations) {
          unsubscribe();
          subscriber.next(correlations);
          subscriber.complete();
        }
      });
    }
  });
};

export const processQueryResponse = (
  state: ExploreItemState,
  action: PayloadAction<QueryEndedPayload>
): ExploreItemState => {
  const { response } = action.payload;
  const {
    request,
    state: loadingState,
    series,
    error,
    graphResult,
    logsResult,
    tableResult,
    traceFrames,
    nodeGraphFrames,
    flameGraphFrames,
  } = response;

  if (error) {
    if (error.type === DataQueryErrorType.Timeout) {
      return {
        ...state,
        queryResponse: response,
        loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming,
      };
    } else if (error.type === DataQueryErrorType.Cancelled) {
      return state;
    }

    // Send error to Angular editors
    // When angularSupportEnabled is removed we can remove this code and all references to eventBridge
    if (config.angularSupportEnabled && state.datasourceInstance?.components?.QueryCtrl) {
      state.eventBridge.emit(PanelEvents.dataError, error);
    }
  }

  if (!request) {
    return { ...state };
  }

  // Send legacy data to Angular editors
  // When angularSupportEnabled is removed we can remove this code and all references to eventBridge
  if (config.angularSupportEnabled && state.datasourceInstance?.components?.QueryCtrl) {
    const legacy = series.map((v) => toLegacyResponseData(v));
    state.eventBridge.emit(PanelEvents.dataReceived, legacy);
  }

  return {
    ...state,
    queryResponse: response,
    graphResult,
    tableResult,
    logsResult,
    loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming,
    showLogs: !!logsResult,
    showMetrics: !!graphResult,
    showTable: !!tableResult?.length,
    showTrace: !!traceFrames.length,
    showNodeGraph: !!nodeGraphFrames.length,
    showFlameGraph: !!flameGraphFrames.length,
  };
};

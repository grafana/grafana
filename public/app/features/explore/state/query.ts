import { AnyAction, createAction, PayloadAction } from '@reduxjs/toolkit';
import deepEqual from 'fast-deep-equal';
import { flatten, groupBy, head, map, mapValues, snakeCase, zipObject } from 'lodash';
import { combineLatest, identity, Observable, of, SubscriptionLike, Unsubscribable } from 'rxjs';
import { mergeMap, throttleTime } from 'rxjs/operators';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQueryErrorType,
  DataQueryResponse,
  DataSourceApi,
  hasQueryExportSupport,
  hasQueryImportSupport,
  HistoryItem,
  LoadingState,
  LogsVolumeType,
  PanelEvents,
  QueryFixAction,
  ScopedVars,
  SupplementaryQueryType,
  toLegacyResponseData,
} from '@grafana/data';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
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
import { getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { store } from 'app/store/store';
import {
  createAsyncThunk,
  ExploreItemState,
  ExplorePanelData,
  QueryTransaction,
  StoreState,
  ThunkDispatch,
  ThunkResult,
} from 'app/types';
import { ExploreState, QueryOptions, SupplementaryQueries } from 'app/types/explore';

import { notifyApp } from '../../../core/actions';
import { createErrorNotification } from '../../../core/copy/appNotification';
import { runRequest } from '../../query/state/runRequest';
import { decorateData } from '../utils/decorators';
import {
  getSupplementaryQueryProvider,
  storeSupplementaryQueryEnabled,
  supplementaryQueryTypes,
} from '../utils/supplementaryQueries';

import { saveCorrelationsAction } from './explorePane';
import { addHistoryItem, historyUpdatedAction, loadRichHistory } from './history';
import { updateTime } from './time';
import { createCacheKey, filterLogRowsByIndex, getDatasourceUIDs, getResultsFromCache } from './utils';

/**
 * Derives from explore state if a given Explore pane is waiting for more data to be received
 */
export const selectIsWaitingForData = (exploreId: string) => {
  return (state: StoreState) => {
    const panelState = state.explore.panes[exploreId];
    if (!panelState) {
      return false;
    }
    return panelState.queryResponse
      ? panelState.queryResponse.state === LoadingState.Loading ||
          panelState.queryResponse.state === LoadingState.Streaming
      : false;
  };
};

/**
 * Adds a query row after the row with the given index.
 */
export interface AddQueryRowPayload {
  exploreId: string;
  index: number;
  query: DataQuery;
}
export const addQueryRowAction = createAction<AddQueryRowPayload>('explore/addQueryRow');

/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export interface ChangeQueriesPayload {
  exploreId: string;
  queries: DataQuery[];
}
export const changeQueriesAction = createAction<ChangeQueriesPayload>('explore/changeQueries');

/**
 * Cancel running queries.
 */
export interface CancelQueriesPayload {
  exploreId: string;
}
export const cancelQueriesAction = createAction<CancelQueriesPayload>('explore/cancelQueries');

export interface QueriesImportedPayload {
  exploreId: string;
  queries: DataQuery[];
}
export const queriesImportedAction = createAction<QueriesImportedPayload>('explore/queriesImported');

export interface QueryStoreSubscriptionPayload {
  exploreId: string;
  querySubscription: Unsubscribable;
}

export const queryStoreSubscriptionAction = createAction<QueryStoreSubscriptionPayload>(
  'explore/queryStoreSubscription'
);

const setSupplementaryQueryEnabledAction = createAction<{
  exploreId: string;
  type: SupplementaryQueryType;
  enabled: boolean;
}>('explore/setSupplementaryQueryEnabledAction');

export interface StoreSupplementaryQueryDataProvider {
  exploreId: string;
  dataProvider?: Observable<DataQueryResponse>;
  type: SupplementaryQueryType;
}

export interface CleanSupplementaryQueryDataProvider {
  exploreId: string;
  type: SupplementaryQueryType;
}

/**
 * Stores available supplementary query data provider after running the query. Used internally by runQueries().
 */
export const storeSupplementaryQueryDataProviderAction = createAction<StoreSupplementaryQueryDataProvider>(
  'explore/storeSupplementaryQueryDataProviderAction'
);

export const cleanSupplementaryQueryDataProviderAction = createAction<CleanSupplementaryQueryDataProvider>(
  'explore/cleanSupplementaryQueryDataProviderAction'
);

export const cleanSupplementaryQueryAction = createAction<{ exploreId: string; type: SupplementaryQueryType }>(
  'explore/cleanSupplementaryQueryAction'
);

export interface StoreSupplementaryQueryDataSubscriptionPayload {
  exploreId: string;
  dataSubscription?: SubscriptionLike;
  type: SupplementaryQueryType;
}

/**
 * Stores current logs volume subscription for given explore pane.
 */
const storeSupplementaryQueryDataSubscriptionAction = createAction<StoreSupplementaryQueryDataSubscriptionPayload>(
  'explore/storeSupplementaryQueryDataSubscriptionAction'
);

/**
 * Stores data returned by the provider. Used internally by loadSupplementaryQueryData().
 */
const updateSupplementaryQueryDataAction = createAction<{
  exploreId: string;
  type: SupplementaryQueryType;
  data: DataQueryResponse;
}>('explore/updateSupplementaryQueryDataAction');

export interface QueryEndedPayload {
  exploreId: string;
  response: ExplorePanelData;
}
export const queryStreamUpdatedAction = createAction<QueryEndedPayload>('explore/queryStreamUpdated');

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 */
export interface SetQueriesPayload {
  exploreId: string;
  queries: DataQuery[];
}
export const setQueriesAction = createAction<SetQueriesPayload>('explore/setQueries');

export interface ChangeLoadingStatePayload {
  exploreId: string;
  loadingState: LoadingState;
}
export const changeLoadingStateAction = createAction<ChangeLoadingStatePayload>('changeLoadingState');

export interface SetPausedStatePayload {
  exploreId: string;
  isPaused: boolean;
}
export const setPausedStateAction = createAction<SetPausedStatePayload>('explore/setPausedState');

export interface ClearLogsPayload {
  exploreId: string;
}
export const clearLogs = createAction<ClearLogsPayload>('explore/clearLogs');
/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export interface ScanStartPayload {
  exploreId: string;
}
export const scanStartAction = createAction<ScanStartPayload>('explore/scanStart');

/**
 * Stop any scanning for more results.
 */
export interface ScanStopPayload {
  exploreId: string;
}
export const scanStopAction = createAction<ScanStopPayload>('explore/scanStop');

/**
 * Adds query results to cache.
 * This is currently used to cache last 5 query results for log queries run from logs navigation (pagination).
 */
export interface AddResultsToCachePayload {
  exploreId: string;
  cacheKey: string;
  queryResponse: ExplorePanelData;
}
export const addResultsToCacheAction = createAction<AddResultsToCachePayload>('explore/addResultsToCache');

/**
 *  Clears cache.
 */
export interface ClearCachePayload {
  exploreId: string;
}
export const clearCacheAction = createAction<ClearCachePayload>('explore/clearCache');

/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId: string, index: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    const queries = getState().explore.panes[exploreId]!.queries;
    let datasourceOverride = undefined;

    // if this is the first query being added, check for a root datasource
    // if it's not mixed, send it as an override. generateEmptyQuery doesn't have access to state
    if (queries.length === 0) {
      const rootDatasource = getState().explore.panes[exploreId]!.datasourceInstance;
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
export function cancelQueries(exploreId: string): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch(scanStopAction({ exploreId }));
    dispatch(cancelQueriesAction({ exploreId }));

    const supplementaryQueries = getState().explore.panes[exploreId]!.supplementaryQueries;
    // Cancel all data providers
    for (const type of supplementaryQueryTypes) {
      dispatch(cleanSupplementaryQueryDataProviderAction({ exploreId, type }));

      // And clear any incomplete data
      if (supplementaryQueries[type]?.data?.state !== LoadingState.Done) {
        dispatch(cleanSupplementaryQueryAction({ exploreId, type }));
      }
    }
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

export const changeQueries = createAsyncThunk<void, ChangeQueriesPayload>(
  'explore/changeQueries',
  async ({ queries, exploreId }, { getState, dispatch }) => {
    let queriesImported = false;
    const oldQueries = getState().explore.panes[exploreId]!.queries;
    const rootUID = getState().explore.panes[exploreId]!.datasourceInstance?.uid;

    for (const newQuery of queries) {
      for (const oldQuery of oldQueries) {
        if (newQuery.refId === oldQuery.refId && newQuery.datasource?.type !== oldQuery.datasource?.type) {
          const queryDatasource = await getDataSourceSrv().get(oldQuery.datasource);
          const targetDS = await getDataSourceSrv().get({ uid: newQuery.datasource?.uid });
          await dispatch(importQueries(exploreId, oldQueries, queryDatasource, targetDS, newQuery.refId));
          queriesImported = true;
        }

        if (
          rootUID === MIXED_DATASOURCE_NAME &&
          newQuery.refId === oldQuery.refId &&
          newQuery.datasource?.uid !== oldQuery.datasource?.uid
        ) {
          const datasourceUIDs = getDatasourceUIDs(MIXED_DATASOURCE_NAME, queries);
          const correlations = await getCorrelationsBySourceUIDs(datasourceUIDs);
          dispatch(saveCorrelationsAction({ exploreId: exploreId, correlations: correlations.correlations || [] }));
        }
      }
    }

    // Importing queries changes the same state, therefore if we are importing queries we don't want to change the state again
    if (!queriesImported) {
      dispatch(changeQueriesAction({ queries, exploreId }));
    }

    // if we are removing a query we want to run the remaining ones
    if (queries.length < oldQueries.length) {
      dispatch(runQueries({ exploreId }));
    }
  }
);

/**
 * Import queries from previous datasource if possible eg Loki and Prometheus have similar query language so the
 * labels part can be reused to get similar data.
 * @param exploreId
 * @param queries
 * @param sourceDataSource
 * @param targetDataSource
 */
export const importQueries = (
  exploreId: string,
  queries: DataQuery[],
  sourceDataSource: DataSourceApi | undefined | null,
  targetDataSource: DataSourceApi,
  singleQueryChangeRef?: string // when changing one query DS to another in a mixed environment, we do not want to change all queries, just the one being changed
): ThunkResult<Promise<DataQuery[] | void>> => {
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
    return nextQueries;
  };
};

/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export function modifyQueries(
  exploreId: string,
  modification: QueryFixAction,
  modifier: (query: DataQuery, modification: QueryFixAction) => Promise<DataQuery>
): ThunkResult<void> {
  return async (dispatch, getState) => {
    const state = getState().explore.panes[exploreId]!;

    const { queries } = state;

    const nextQueriesRaw = await Promise.all(queries.map((query) => modifier({ ...query }, modification)));

    const nextQueries = nextQueriesRaw.map((nextQuery, i) => {
      return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries, i);
    });

    dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
    if (!modification.preventSubmit) {
      dispatch(runQueries({ exploreId }));
    }
  };
}

async function handleHistory(
  dispatch: ThunkDispatch,
  state: ExploreState,
  history: Array<HistoryItem<DataQuery>>,
  datasource: DataSourceApi,
  queries: DataQuery[],
  exploreId: string
) {
  const datasourceId = datasource.meta.id;
  const nextHistory = updateHistory(history, datasourceId, queries);
  dispatch(historyUpdatedAction({ exploreId, history: nextHistory }));

  dispatch(addHistoryItem(datasource.uid, datasource.name, queries));

  // Because filtering happens in the backend we cannot add a new entry without checking if it matches currently
  // used filters. Instead, we refresh the query history list.
  // TODO: run only if Query History list is opened (#47252)
  for (const exploreId in state.panes) {
    await dispatch(loadRichHistory(exploreId));
  }
}

interface RunQueriesOptions {
  exploreId: string;
  preserveCache?: boolean;
}
/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export const runQueries = createAsyncThunk<void, RunQueriesOptions>(
  'explore/runQueries',
  async ({ exploreId, preserveCache }, { dispatch, getState }) => {
    dispatch(updateTime({ exploreId }));

    const correlations$ = getCorrelations(exploreId);

    // We always want to clear cache unless we explicitly pass preserveCache parameter
    if (preserveCache !== true) {
      dispatch(clearCache(exploreId));
    }

    const exploreItemState = getState().explore.panes[exploreId]!;
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
      supplementaryQueries,
    } = exploreItemState;
    let newQuerySource: Observable<ExplorePanelData>;
    let newQuerySubscription: SubscriptionLike;

    const queries = exploreItemState.queries.map((query) => ({
      ...query,
      datasource: query.datasource || datasourceInstance?.getRef(),
    }));

    if (datasourceInstance != null) {
      handleHistory(dispatch, getState().explore, exploreItemState.history, datasourceInstance, queries, exploreId);
    }

    const cachedValue = getResultsFromCache(cache, absoluteRange);

    // If we have results saved in cache, we are going to use those results instead of running queries
    if (cachedValue) {
      newQuerySource = combineLatest([of(cachedValue), correlations$]).pipe(
        mergeMap(([data, correlations]) =>
          decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, correlations)
        )
      );

      newQuerySubscription = newQuerySource.subscribe((data) => {
        dispatch(queryStreamUpdatedAction({ exploreId, response: data }));
      });

      // If we don't have results saved in cache, run new queries
    } else {
      if (!hasNonEmptyQuery(queries) || !datasourceInstance) {
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

      newQuerySource = combineLatest([
        runRequest(datasourceInstance, transaction.request)
          // Simple throttle for live tailing, in case of > 1000 rows per interval we spend about 200ms on processing and
          // rendering. In case this is optimized this can be tweaked, but also it should be only as fast as user
          // actually can see what is happening.
          .pipe(live ? throttleTime(500) : identity),
        correlations$,
      ]).pipe(
        mergeMap(([data, correlations]) =>
          decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, correlations)
        )
      );

      newQuerySubscription = newQuerySource.subscribe({
        next(data) {
          if (data.logsResult !== null) {
            reportInteraction('grafana_explore_logs_result_displayed', {
              datasourceType: datasourceInstance.type,
            });
          }
          dispatch(queryStreamUpdatedAction({ exploreId, response: data }));

          // Keep scanning for results if this was the last scanning transaction
          if (getState().explore.panes[exploreId]!.scanning) {
            if (data.state === LoadingState.Done && data.series.length === 0) {
              const range = getShiftedTimeRange(-1, getState().explore.panes[exploreId]!.range);
              dispatch(updateTime({ exploreId, absoluteRange: range }));
              dispatch(runQueries({ exploreId }));
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
          if (getState().explore.panes[exploreId]!.queryResponse.state === LoadingState.Loading) {
            dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Done }));
          }
        },
      });

      if (live) {
        for (const type of supplementaryQueryTypes) {
          dispatch(
            cleanSupplementaryQueryDataProviderAction({
              exploreId,
              type,
            })
          );
          dispatch(cleanSupplementaryQueryAction({ exploreId, type }));
        }
      } else {
        dispatch(
          handleSupplementaryQueries({
            exploreId,
            datasourceInstance,
            transaction,
            newQuerySource,
            supplementaryQueries,
            queries,
            absoluteRange,
          })
        );
      }
    }

    dispatch(queryStoreSubscriptionAction({ exploreId, querySubscription: newQuerySubscription }));
  }
);

const groupDataQueries = async (datasources: DataQuery[], scopedVars: ScopedVars) => {
  const nonMixedDataSources = datasources.filter((t) => {
    return t.datasource?.uid !== MIXED_DATASOURCE_NAME;
  });
  const sets: { [key: string]: DataQuery[] } = groupBy(nonMixedDataSources, 'datasource.uid');

  return await Promise.all(
    Object.values(sets).map(async (targets) => {
      const datasource = await getDataSourceSrv().get(targets[0].datasource, scopedVars);
      return {
        datasource,
        targets,
      };
    })
  );
};

type HandleSupplementaryQueriesOptions = {
  exploreId: string;
  transaction: QueryTransaction;
  datasourceInstance: DataSourceApi;
  newQuerySource: Observable<ExplorePanelData>;
  supplementaryQueries: SupplementaryQueries;
  queries: DataQuery[];
  absoluteRange: AbsoluteTimeRange;
};

const handleSupplementaryQueries = createAsyncThunk(
  'explore/handleSupplementaryQueries',
  async (
    {
      datasourceInstance,
      exploreId,
      transaction,
      newQuerySource,
      supplementaryQueries,
      queries,
      absoluteRange,
    }: HandleSupplementaryQueriesOptions,
    { dispatch }
  ) => {
    let groupedQueries;
    if (datasourceInstance.meta.mixed) {
      groupedQueries = await groupDataQueries(transaction.request.targets, transaction.request.scopedVars);
    } else {
      groupedQueries = [{ datasource: datasourceInstance, targets: transaction.request.targets }];
    }

    for (const type of supplementaryQueryTypes) {
      // We always prepare provider, even is supplementary query is disabled because when the user
      // enables the query, we need to load the data, so we need the provider
      const dataProvider = getSupplementaryQueryProvider(
        groupedQueries,
        type,
        {
          ...transaction.request,
          requestId: `${transaction.request.requestId}_${snakeCase(type)}`,
        },
        newQuerySource
      );

      if (dataProvider) {
        dispatch(
          storeSupplementaryQueryDataProviderAction({
            exploreId,
            type,
            dataProvider,
          })
        );

        if (!canReuseSupplementaryQueryData(supplementaryQueries[type].data, queries, absoluteRange)) {
          dispatch(cleanSupplementaryQueryAction({ exploreId, type }));
          if (supplementaryQueries[type].enabled) {
            dispatch(loadSupplementaryQueryData(exploreId, type));
          }
        }
      } else {
        // If data source instance doesn't support this supplementary query, we clean the data provider
        dispatch(
          cleanSupplementaryQueryDataProviderAction({
            exploreId,
            type,
          })
        );
      }
    }
  }
);

/**
 * Checks if after changing the time range the existing data can be used to show supplementary query.
 * It can happen if queries are the same and new time range is within existing data time range.
 */
function canReuseSupplementaryQueryData(
  supplementaryQueryData: DataQueryResponse | undefined,
  newQueries: DataQuery[],
  selectedTimeRange: AbsoluteTimeRange
): boolean {
  if (!supplementaryQueryData) {
    return false;
  }

  const newQueriesByRefId = zipObject(map(newQueries, 'refId'), newQueries);

  const existingDataByRefId = mapValues(
    groupBy(
      supplementaryQueryData.data.map((dataFrame: DataFrame) => dataFrame.meta?.custom?.sourceQuery),
      'refId'
    ),
    head
  );

  const allSupportZoomingIn = supplementaryQueryData.data.every((data: DataFrame) => {
    // If log volume is based on returned log lines (i.e. LogsVolumeType.Limited),
    // zooming in may return different results, so we don't want to reuse the data
    return data.meta?.custom?.logsVolumeType === LogsVolumeType.FullRange;
  });

  const allQueriesAreTheSame = deepEqual(newQueriesByRefId, existingDataByRefId);

  const allResultsHaveWiderRange = supplementaryQueryData.data.every((data: DataFrame) => {
    const dataRange = data.meta?.custom?.absoluteRange;
    // Only first data frame in the response may contain the absolute range
    if (!dataRange) {
      return true;
    }
    const hasWiderRange = dataRange && dataRange.from <= selectedTimeRange.from && selectedTimeRange.to <= dataRange.to;
    return hasWiderRange;
  });

  return allSupportZoomingIn && allQueriesAreTheSame && allResultsHaveWiderRange;
}

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId: string, rawQueries: DataQuery[]): ThunkResult<void> {
  return (dispatch, getState) => {
    // Inject react keys into query objects
    const queries = getState().explore.panes[exploreId]!.queries;
    const nextQueries = rawQueries.map((query, index) => generateNewKeyAndAddRefIdIfMissing(query, queries, index));
    dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
    dispatch(runQueries({ exploreId }));
  };
}

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId: string): ThunkResult<void> {
  return (dispatch, getState) => {
    // Register the scanner
    dispatch(scanStartAction({ exploreId }));
    // Scanning must trigger query run, and return the new range
    const range = getShiftedTimeRange(-1, getState().explore.panes[exploreId]!.range);
    // Set the new range to be displayed
    dispatch(updateTime({ exploreId, absoluteRange: range }));
    dispatch(runQueries({ exploreId }));
  };
}

export function addResultsToCache(exploreId: string): ThunkResult<void> {
  return (dispatch, getState) => {
    const queryResponse = getState().explore.panes[exploreId]!.queryResponse;
    const absoluteRange = getState().explore.panes[exploreId]!.absoluteRange;
    const cacheKey = createCacheKey(absoluteRange);

    // Save results to cache only when all results received and loading is done
    if (queryResponse.state === LoadingState.Done) {
      dispatch(addResultsToCacheAction({ exploreId, cacheKey, queryResponse }));
    }
  };
}

export function clearCache(exploreId: string): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch(clearCacheAction({ exploreId }));
  };
}

/**
 * Initializes loading logs volume data and stores emitted value.
 */
export function loadSupplementaryQueryData(exploreId: string, type: SupplementaryQueryType): ThunkResult<void> {
  return (dispatch, getState) => {
    const { supplementaryQueries } = getState().explore.panes[exploreId]!;
    const dataProvider = supplementaryQueries[type].dataProvider;

    if (dataProvider) {
      const dataSubscription = dataProvider.subscribe({
        next: (supplementaryQueryData: DataQueryResponse) => {
          dispatch(updateSupplementaryQueryDataAction({ exploreId, type, data: supplementaryQueryData }));
        },
      });
      dispatch(
        storeSupplementaryQueryDataSubscriptionAction({
          exploreId,
          type,
          dataSubscription,
        })
      );
    }
  };
}

export function setSupplementaryQueryEnabled(
  exploreId: string,
  enabled: boolean,
  type: SupplementaryQueryType
): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch(setSupplementaryQueryEnabledAction({ exploreId, enabled, type }));
    storeSupplementaryQueryEnabled(enabled, type);
    if (enabled) {
      dispatch(loadSupplementaryQueryData(exploreId, type));
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
      queryResponse: {
        ...state.queryResponse,
        state: LoadingState.Done,
      },
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

  if (setSupplementaryQueryEnabledAction.match(action)) {
    const { enabled, type } = action.payload;
    const { supplementaryQueries } = state;
    const dataSubscription = supplementaryQueries[type].dataSubscription;
    if (!enabled && dataSubscription) {
      dataSubscription.unsubscribe();
    }

    const nextSupplementaryQueries: SupplementaryQueries = {
      ...supplementaryQueries,
      // NOTE: the dataProvider is not cleared, we may need it later,
      // if the user re-enables the supplementary query
      [type]: { ...supplementaryQueries[type], enabled, data: undefined },
    };

    return {
      ...state,
      supplementaryQueries: nextSupplementaryQueries,
    };
  }

  if (storeSupplementaryQueryDataProviderAction.match(action)) {
    const { dataProvider, type } = action.payload;
    const { supplementaryQueries } = state;
    const supplementaryQuery = supplementaryQueries[type];

    if (supplementaryQuery?.dataSubscription) {
      supplementaryQuery.dataSubscription.unsubscribe();
    }

    const nextSupplementaryQueries = {
      ...supplementaryQueries,
      [type]: { ...supplementaryQuery, dataProvider, dataSubscription: undefined },
    };

    return {
      ...state,
      supplementaryQueries: nextSupplementaryQueries,
    };
  }

  if (cleanSupplementaryQueryDataProviderAction.match(action)) {
    const { type } = action.payload;
    const { supplementaryQueries } = state;
    const supplementaryQuery = supplementaryQueries[type];

    if (supplementaryQuery?.dataSubscription) {
      supplementaryQuery.dataSubscription.unsubscribe();
    }

    const nextSupplementaryQueries = {
      ...supplementaryQueries,
      [type]: { ...supplementaryQuery, dataProvider: undefined, dataSubscription: undefined },
    };

    return {
      ...state,
      supplementaryQueries: nextSupplementaryQueries,
    };
  }

  if (cleanSupplementaryQueryAction.match(action)) {
    const { type } = action.payload;
    const { supplementaryQueries } = state;
    const nextSupplementaryQueries = {
      ...supplementaryQueries,
      [type]: { ...supplementaryQueries[type], data: undefined },
    };
    return {
      ...state,
      supplementaryQueries: nextSupplementaryQueries,
    };
  }

  if (storeSupplementaryQueryDataSubscriptionAction.match(action)) {
    const { dataSubscription, type } = action.payload;

    const { supplementaryQueries } = state;
    const nextSupplementaryQueries = {
      ...supplementaryQueries,
      [type]: { ...supplementaryQueries[type], dataSubscription },
    };

    return {
      ...state,
      supplementaryQueries: nextSupplementaryQueries,
    };
  }

  if (updateSupplementaryQueryDataAction.match(action)) {
    let { data, type } = action.payload;
    const { supplementaryQueries } = state;

    const nextSupplementaryQueries = {
      ...supplementaryQueries,
      [type]: { ...supplementaryQueries[type], data },
    };

    return {
      ...state,
      supplementaryQueries: nextSupplementaryQueries,
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

  if (clearLogs.match(action)) {
    if (!state.logsResult) {
      return {
        ...state,
        clearedAtIndex: null,
      };
    }

    // When in loading state, clear logs and set clearedAtIndex as null.
    // Initially loaded logs will be fully replaced by incoming streamed logs, which may have a different length.
    if (state.queryResponse.state === LoadingState.Loading) {
      return {
        ...state,
        clearedAtIndex: null,
        logsResult: {
          ...state.logsResult,
          rows: [],
        },
      };
    }

    const lastItemIndex = state.clearedAtIndex
      ? state.clearedAtIndex + state.logsResult.rows.length
      : state.logsResult.rows.length - 1;

    return {
      ...state,
      clearedAtIndex: lastItemIndex,
      logsResult: {
        ...state.logsResult,
        rows: [],
      },
    };
  }

  return state;
};

/**
 * Creates an observable that emits correlations once they are loaded
 */
const getCorrelations = (exploreId: string) => {
  return new Observable<CorrelationData[]>((subscriber) => {
    const existingCorrelations = store.getState().explore.panes[exploreId]?.correlations;
    if (existingCorrelations) {
      subscriber.next(existingCorrelations);
      subscriber.complete();
    } else {
      const unsubscribe = store.subscribe(() => {
        const correlations = store.getState().explore.panes[exploreId]?.correlations;
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
    series,
    error,
    graphResult,
    logsResult,
    tableResult,
    rawPrometheusResult,
    traceFrames,
    nodeGraphFrames,
    flameGraphFrames,
    rawPrometheusFrames,
  } = response;

  if (error) {
    if (error.type === DataQueryErrorType.Timeout || error.type === DataQueryErrorType.Cancelled) {
      return { ...state };
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
    rawPrometheusResult,
    logsResult:
      state.isLive && logsResult
        ? { ...logsResult, rows: filterLogRowsByIndex(state.clearedAtIndex, logsResult.rows) }
        : logsResult,
    showLogs: !!logsResult,
    showMetrics: !!graphResult,
    showTable: !!tableResult?.length,
    showTrace: !!traceFrames.length,
    showNodeGraph: !!nodeGraphFrames.length,
    showRawPrometheus: !!rawPrometheusFrames.length,
    showFlameGraph: !!flameGraphFrames.length,
    clearedAtIndex: state.isLive ? state.clearedAtIndex : null,
  };
};

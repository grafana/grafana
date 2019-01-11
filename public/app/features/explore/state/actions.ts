import _ from 'lodash';
import { ThunkAction } from 'redux-thunk';
import { RawTimeRange, TimeRange } from '@grafana/ui';

import {
  LAST_USED_DATASOURCE_KEY,
  ensureQueries,
  generateEmptyQuery,
  hasNonEmptyQuery,
  makeTimeSeriesList,
  updateHistory,
  buildQueryTransaction,
} from 'app/core/utils/explore';

import store from 'app/core/store';
import { DataSourceSelectItem } from 'app/types/datasources';
import { DataQuery, StoreState } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import {
  ExploreId,
  HistoryItem,
  RangeScanner,
  ResultType,
  QueryOptions,
  QueryTransaction,
  QueryHint,
  QueryHintGetter,
} from 'app/types/explore';
import { Emitter } from 'app/core/core';
import { ExploreItemState } from './reducers';

export enum ActionTypes {
  AddQueryRow = 'ADD_QUERY_ROW',
  ChangeDatasource = 'CHANGE_DATASOURCE',
  ChangeQuery = 'CHANGE_QUERY',
  ChangeSize = 'CHANGE_SIZE',
  ChangeTime = 'CHANGE_TIME',
  ClickClear = 'CLICK_CLEAR',
  ClickCloseSplit = 'CLICK_CLOSE_SPLIT',
  ClickExample = 'CLICK_EXAMPLE',
  ClickGraphButton = 'CLICK_GRAPH_BUTTON',
  ClickLogsButton = 'CLICK_LOGS_BUTTON',
  ClickSplit = 'CLICK_SPLIT',
  ClickTableButton = 'CLICK_TABLE_BUTTON',
  HighlightLogsExpression = 'HIGHLIGHT_LOGS_EXPRESSION',
  InitializeExplore = 'INITIALIZE_EXPLORE',
  LoadDatasourceFailure = 'LOAD_DATASOURCE_FAILURE',
  LoadDatasourceMissing = 'LOAD_DATASOURCE_MISSING',
  LoadDatasourcePending = 'LOAD_DATASOURCE_PENDING',
  LoadDatasourceSuccess = 'LOAD_DATASOURCE_SUCCESS',
  ModifyQueries = 'MODIFY_QUERIES',
  QueryTransactionFailure = 'QUERY_TRANSACTION_FAILURE',
  QueryTransactionStart = 'QUERY_TRANSACTION_START',
  QueryTransactionSuccess = 'QUERY_TRANSACTION_SUCCESS',
  RemoveQueryRow = 'REMOVE_QUERY_ROW',
  RunQueries = 'RUN_QUERIES',
  RunQueriesEmpty = 'RUN_QUERIES',
  ScanRange = 'SCAN_RANGE',
  ScanStart = 'SCAN_START',
  ScanStop = 'SCAN_STOP',
}

export interface AddQueryRowAction {
  type: ActionTypes.AddQueryRow;
  exploreId: ExploreId;
  index: number;
  query: DataQuery;
}

export interface ChangeQueryAction {
  type: ActionTypes.ChangeQuery;
  exploreId: ExploreId;
  query: DataQuery;
  index: number;
  override: boolean;
}

export interface ChangeSizeAction {
  type: ActionTypes.ChangeSize;
  exploreId: ExploreId;
  width: number;
  height: number;
}

export interface ChangeTimeAction {
  type: ActionTypes.ChangeTime;
  exploreId: ExploreId;
  range: TimeRange;
}

export interface ClickClearAction {
  type: ActionTypes.ClickClear;
  exploreId: ExploreId;
}

export interface ClickCloseSplitAction {
  type: ActionTypes.ClickCloseSplit;
}

export interface ClickExampleAction {
  type: ActionTypes.ClickExample;
  exploreId: ExploreId;
  query: DataQuery;
}

export interface ClickGraphButtonAction {
  type: ActionTypes.ClickGraphButton;
  exploreId: ExploreId;
}

export interface ClickLogsButtonAction {
  type: ActionTypes.ClickLogsButton;
  exploreId: ExploreId;
}

export interface ClickSplitAction {
  type: ActionTypes.ClickSplit;
  itemState: ExploreItemState;
}

export interface ClickTableButtonAction {
  type: ActionTypes.ClickTableButton;
  exploreId: ExploreId;
}

export interface InitializeExploreAction {
  type: ActionTypes.InitializeExplore;
  exploreId: ExploreId;
  containerWidth: number;
  datasource: string;
  eventBridge: Emitter;
  exploreDatasources: DataSourceSelectItem[];
  queries: DataQuery[];
  range: RawTimeRange;
}

export interface HighlightLogsExpressionAction {
  type: ActionTypes.HighlightLogsExpression;
  exploreId: ExploreId;
  expressions: string[];
}

export interface LoadDatasourceFailureAction {
  type: ActionTypes.LoadDatasourceFailure;
  exploreId: ExploreId;
  error: string;
}

export interface LoadDatasourcePendingAction {
  type: ActionTypes.LoadDatasourcePending;
  exploreId: ExploreId;
  datasourceId: number;
}

export interface LoadDatasourceMissingAction {
  type: ActionTypes.LoadDatasourceMissing;
  exploreId: ExploreId;
}

export interface LoadDatasourceSuccessAction {
  type: ActionTypes.LoadDatasourceSuccess;
  exploreId: ExploreId;
  StartPage?: any;
  datasourceInstance: any;
  history: HistoryItem[];
  initialDatasource: string;
  initialQueries: DataQuery[];
  logsHighlighterExpressions?: any[];
  showingStartPage: boolean;
  supportsGraph: boolean;
  supportsLogs: boolean;
  supportsTable: boolean;
}

export interface ModifyQueriesAction {
  type: ActionTypes.ModifyQueries;
  exploreId: ExploreId;
  modification: any;
  index: number;
  modifier: (queries: DataQuery[], modification: any) => DataQuery[];
}

export interface QueryTransactionFailureAction {
  type: ActionTypes.QueryTransactionFailure;
  exploreId: ExploreId;
  queryTransactions: QueryTransaction[];
}

export interface QueryTransactionStartAction {
  type: ActionTypes.QueryTransactionStart;
  exploreId: ExploreId;
  resultType: ResultType;
  rowIndex: number;
  transaction: QueryTransaction;
}

export interface QueryTransactionSuccessAction {
  type: ActionTypes.QueryTransactionSuccess;
  exploreId: ExploreId;
  history: HistoryItem[];
  queryTransactions: QueryTransaction[];
}

export interface RemoveQueryRowAction {
  type: ActionTypes.RemoveQueryRow;
  exploreId: ExploreId;
  index: number;
}

export interface ScanStartAction {
  type: ActionTypes.ScanStart;
  exploreId: ExploreId;
  scanner: RangeScanner;
}

export interface ScanRangeAction {
  type: ActionTypes.ScanRange;
  exploreId: ExploreId;
  range: RawTimeRange;
}

export interface ScanStopAction {
  type: ActionTypes.ScanStop;
  exploreId: ExploreId;
}

export type Action =
  | AddQueryRowAction
  | ChangeQueryAction
  | ChangeSizeAction
  | ChangeTimeAction
  | ClickClearAction
  | ClickCloseSplitAction
  | ClickExampleAction
  | ClickGraphButtonAction
  | ClickLogsButtonAction
  | ClickSplitAction
  | ClickTableButtonAction
  | HighlightLogsExpressionAction
  | InitializeExploreAction
  | LoadDatasourceFailureAction
  | LoadDatasourceMissingAction
  | LoadDatasourcePendingAction
  | LoadDatasourceSuccessAction
  | ModifyQueriesAction
  | QueryTransactionFailureAction
  | QueryTransactionStartAction
  | QueryTransactionSuccessAction
  | RemoveQueryRowAction
  | ScanRangeAction
  | ScanStartAction
  | ScanStopAction;
type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function addQueryRow(exploreId: ExploreId, index: number): AddQueryRowAction {
  const query = generateEmptyQuery(index + 1);
  return { type: ActionTypes.AddQueryRow, exploreId, index, query };
}

export function changeDatasource(exploreId: ExploreId, datasource: string): ThunkResult<void> {
  return async dispatch => {
    const instance = await getDatasourceSrv().get(datasource);
    dispatch(loadDatasource(exploreId, instance));
  };
}

export function changeQuery(
  exploreId: ExploreId,
  query: DataQuery,
  index: number,
  override: boolean
): ThunkResult<void> {
  return dispatch => {
    // Null query means reset
    if (query === null) {
      query = { ...generateEmptyQuery(index) };
    }

    dispatch({ type: ActionTypes.ChangeQuery, exploreId, query, index, override });
    if (override) {
      dispatch(runQueries(exploreId));
    }
  };
}

export function changeSize(
  exploreId: ExploreId,
  { height, width }: { height: number; width: number }
): ChangeSizeAction {
  return { type: ActionTypes.ChangeSize, exploreId, height, width };
}

export function changeTime(exploreId: ExploreId, range: TimeRange): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ChangeTime, exploreId, range });
    dispatch(runQueries(exploreId));
  };
}

export function clickClear(exploreId: ExploreId): ThunkResult<void> {
  return dispatch => {
    dispatch(scanStop(exploreId));
    dispatch({ type: ActionTypes.ClickClear, exploreId });
    // TODO save state
  };
}

export function clickCloseSplit(): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ClickCloseSplit });
    // When closing split, remove URL state for split part
    // TODO save state
  };
}

export function clickExample(exploreId: ExploreId, rawQuery: DataQuery): ThunkResult<void> {
  return dispatch => {
    const query = { ...rawQuery, ...generateEmptyQuery() };
    dispatch({
      type: ActionTypes.ClickExample,
      exploreId,
      query,
    });
    dispatch(runQueries(exploreId));
  };
}

export function clickGraphButton(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ClickGraphButton, exploreId });
    if (getState().explore[exploreId].showingGraph) {
      dispatch(runQueries(exploreId));
    }
  };
}

export function clickLogsButton(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ClickLogsButton, exploreId });
    if (getState().explore[exploreId].showingLogs) {
      dispatch(runQueries(exploreId));
    }
  };
}

export function clickSplit(): ThunkResult<void> {
  return (dispatch, getState) => {
    // Clone left state to become the right state
    const leftState = getState().explore.left;
    const itemState = {
      ...leftState,
      queryTransactions: [],
      initialQueries: leftState.modifiedQueries.slice(),
    };
    dispatch({ type: ActionTypes.ClickSplit, itemState });
    // TODO save state
  };
}

export function clickTableButton(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ClickTableButton, exploreId });
    if (getState().explore[exploreId].showingTable) {
      dispatch(runQueries(exploreId));
    }
  };
}

export function highlightLogsExpression(exploreId: ExploreId, expressions: string[]): HighlightLogsExpressionAction {
  return { type: ActionTypes.HighlightLogsExpression, exploreId, expressions };
}

export function initializeExplore(
  exploreId: ExploreId,
  datasource: string,
  queries: DataQuery[],
  range: RawTimeRange,
  containerWidth: number,
  eventBridge: Emitter
): ThunkResult<void> {
  return async dispatch => {
    const exploreDatasources: DataSourceSelectItem[] = getDatasourceSrv()
      .getExternal()
      .map(ds => ({
        value: ds.name,
        name: ds.name,
        meta: ds.meta,
      }));

    dispatch({
      type: ActionTypes.InitializeExplore,
      exploreId,
      containerWidth,
      datasource,
      eventBridge,
      exploreDatasources,
      queries,
      range,
    });

    if (exploreDatasources.length > 1) {
      let instance;
      if (datasource) {
        instance = await getDatasourceSrv().get(datasource);
      } else {
        instance = await getDatasourceSrv().get();
      }
      dispatch(loadDatasource(exploreId, instance));
    } else {
      dispatch(loadDatasourceMissing(exploreId));
    }
  };
}

export const loadDatasourceFailure = (exploreId: ExploreId, error: string): LoadDatasourceFailureAction => ({
  type: ActionTypes.LoadDatasourceFailure,
  exploreId,
  error,
});

export const loadDatasourceMissing = (exploreId: ExploreId): LoadDatasourceMissingAction => ({
  type: ActionTypes.LoadDatasourceMissing,
  exploreId,
});

export const loadDatasourcePending = (exploreId: ExploreId, datasourceId: number): LoadDatasourcePendingAction => ({
  type: ActionTypes.LoadDatasourcePending,
  exploreId,
  datasourceId,
});

export const loadDatasourceSuccess = (
  exploreId: ExploreId,
  instance: any,
  queries: DataQuery[]
): LoadDatasourceSuccessAction => {
  // Capabilities
  const supportsGraph = instance.meta.metrics;
  const supportsLogs = instance.meta.logs;
  const supportsTable = instance.meta.tables;
  // Custom components
  const StartPage = instance.pluginExports.ExploreStartPage;

  const historyKey = `grafana.explore.history.${instance.meta.id}`;
  const history = store.getObject(historyKey, []);
  // Save last-used datasource
  store.set(LAST_USED_DATASOURCE_KEY, instance.name);

  return {
    type: ActionTypes.LoadDatasourceSuccess,
    exploreId,
    StartPage,
    datasourceInstance: instance,
    history,
    initialDatasource: instance.name,
    initialQueries: queries,
    showingStartPage: Boolean(StartPage),
    supportsGraph,
    supportsLogs,
    supportsTable,
  };
};

export function loadDatasource(exploreId: ExploreId, instance: any): ThunkResult<void> {
  return async (dispatch, getState) => {
    const datasourceId = instance.meta.id;

    // Keep ID to track selection
    dispatch(loadDatasourcePending(exploreId, datasourceId));

    let datasourceError = null;
    try {
      const testResult = await instance.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || 'Network error';
    }
    if (datasourceError) {
      dispatch(loadDatasourceFailure(exploreId, datasourceError));
      return;
    }

    if (datasourceId !== getState().explore[exploreId].requestedDatasourceId) {
      // User already changed datasource again, discard results
      return;
    }

    if (instance.init) {
      instance.init();
    }

    // Check if queries can be imported from previously selected datasource
    const queries = getState().explore[exploreId].modifiedQueries;
    let importedQueries = queries;
    const origin = getState().explore[exploreId].datasourceInstance;
    if (origin) {
      if (origin.meta.id === instance.meta.id) {
        // Keep same queries if same type of datasource
        importedQueries = [...queries];
      } else if (instance.importQueries) {
        // Datasource-specific importers
        importedQueries = await instance.importQueries(queries, origin.meta);
      } else {
        // Default is blank queries
        importedQueries = ensureQueries();
      }
    }

    if (datasourceId !== getState().explore[exploreId].requestedDatasourceId) {
      // User already changed datasource again, discard results
      return;
    }

    // Reset edit state with new queries
    const nextQueries = importedQueries.map((q, i) => ({
      ...importedQueries[i],
      ...generateEmptyQuery(i),
    }));

    dispatch(loadDatasourceSuccess(exploreId, instance, nextQueries));
    dispatch(runQueries(exploreId));
  };
}

export function modifyQueries(
  exploreId: ExploreId,
  modification: any,
  index: number,
  modifier: any
): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ModifyQueries, exploreId, modification, index, modifier });
    if (!modification.preventSubmit) {
      dispatch(runQueries(exploreId));
    }
  };
}

export function queryTransactionFailure(
  exploreId: ExploreId,
  transactionId: string,
  response: any,
  datasourceId: string
): ThunkResult<void> {
  return (dispatch, getState) => {
    const { datasourceInstance, queryTransactions } = getState().explore[exploreId];
    if (datasourceInstance.meta.id !== datasourceId || response.cancelled) {
      // Navigated away, queries did not matter
      return;
    }

    // Transaction might have been discarded
    if (!queryTransactions.find(qt => qt.id === transactionId)) {
      return null;
    }

    console.error(response);

    let error: string;
    let errorDetails: string;
    if (response.data) {
      if (typeof response.data === 'string') {
        error = response.data;
      } else if (response.data.error) {
        error = response.data.error;
        if (response.data.response) {
          errorDetails = response.data.response;
        }
      } else {
        throw new Error('Could not handle error response');
      }
    } else if (response.message) {
      error = response.message;
    } else if (typeof response === 'string') {
      error = response;
    } else {
      error = 'Unknown error during query transaction. Please check JS console logs.';
    }

    // Mark transactions as complete
    const nextQueryTransactions = queryTransactions.map(qt => {
      if (qt.id === transactionId) {
        return {
          ...qt,
          error,
          errorDetails,
          done: true,
        };
      }
      return qt;
    });

    dispatch({ type: ActionTypes.QueryTransactionFailure, exploreId, queryTransactions: nextQueryTransactions });
  };
}

export function queryTransactionStart(
  exploreId: ExploreId,
  transaction: QueryTransaction,
  resultType: ResultType,
  rowIndex: number
): QueryTransactionStartAction {
  return { type: ActionTypes.QueryTransactionStart, exploreId, resultType, rowIndex, transaction };
}

export function queryTransactionSuccess(
  exploreId: ExploreId,
  transactionId: string,
  result: any,
  latency: number,
  queries: DataQuery[],
  datasourceId: string
): ThunkResult<void> {
  return (dispatch, getState) => {
    const { datasourceInstance, history, queryTransactions, scanner, scanning } = getState().explore[exploreId];

    // If datasource already changed, results do not matter
    if (datasourceInstance.meta.id !== datasourceId) {
      return;
    }

    // Transaction might have been discarded
    const transaction = queryTransactions.find(qt => qt.id === transactionId);
    if (!transaction) {
      return;
    }

    // Get query hints
    let hints: QueryHint[];
    if (datasourceInstance.getQueryHints as QueryHintGetter) {
      hints = datasourceInstance.getQueryHints(transaction.query, result);
    }

    // Mark transactions as complete and attach result
    const nextQueryTransactions = queryTransactions.map(qt => {
      if (qt.id === transactionId) {
        return {
          ...qt,
          hints,
          latency,
          result,
          done: true,
        };
      }
      return qt;
    });

    // Side-effect: Saving history in localstorage
    const nextHistory = updateHistory(history, datasourceId, queries);

    dispatch({
      type: ActionTypes.QueryTransactionSuccess,
      exploreId,
      history: nextHistory,
      queryTransactions: nextQueryTransactions,
    });

    // Keep scanning for results if this was the last scanning transaction
    if (scanning) {
      if (_.size(result) === 0) {
        const other = nextQueryTransactions.find(qt => qt.scanning && !qt.done);
        if (!other) {
          const range = scanner();
          dispatch({ type: ActionTypes.ScanRange, exploreId, range });
        }
      } else {
        // We can stop scanning if we have a result
        dispatch(scanStop(exploreId));
      }
    }
  };
}

export function removeQueryRow(exploreId: ExploreId, index: number): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.RemoveQueryRow, exploreId, index });
    dispatch(runQueries(exploreId));
  };
}

export function runQueries(exploreId: ExploreId) {
  return (dispatch, getState) => {
    const {
      datasourceInstance,
      modifiedQueries,
      showingLogs,
      showingGraph,
      showingTable,
      supportsGraph,
      supportsLogs,
      supportsTable,
    } = getState().explore[exploreId];

    if (!hasNonEmptyQuery(modifiedQueries)) {
      dispatch({ type: ActionTypes.RunQueriesEmpty, exploreId });
      return;
    }

    // Some datasource's query builders allow per-query interval limits,
    // but we're using the datasource interval limit for now
    const interval = datasourceInstance.interval;

    // Keep table queries first since they need to return quickly
    if (showingTable && supportsTable) {
      dispatch(
        runQueriesForType(
          exploreId,
          'Table',
          {
            interval,
            format: 'table',
            instant: true,
            valueWithRefId: true,
          },
          data => data[0]
        )
      );
    }
    if (showingGraph && supportsGraph) {
      dispatch(
        runQueriesForType(
          exploreId,
          'Graph',
          {
            interval,
            format: 'time_series',
            instant: false,
          },
          makeTimeSeriesList
        )
      );
    }
    if (showingLogs && supportsLogs) {
      dispatch(runQueriesForType(exploreId, 'Logs', { interval, format: 'logs' }));
    }
    // TODO save state
  };
}

function runQueriesForType(
  exploreId: ExploreId,
  resultType: ResultType,
  queryOptions: QueryOptions,
  resultGetter?: any
) {
  return async (dispatch, getState) => {
    const {
      datasourceInstance,
      eventBridge,
      modifiedQueries: queries,
      queryIntervals,
      range,
      scanning,
    } = getState().explore[exploreId];
    const datasourceId = datasourceInstance.meta.id;

    // Run all queries concurrently
    queries.forEach(async (query, rowIndex) => {
      const transaction = buildQueryTransaction(
        query,
        rowIndex,
        resultType,
        queryOptions,
        range,
        queryIntervals,
        scanning
      );
      dispatch(queryTransactionStart(exploreId, transaction, resultType, rowIndex));
      try {
        const now = Date.now();
        const res = await datasourceInstance.query(transaction.options);
        eventBridge.emit('data-received', res.data || []);
        const latency = Date.now() - now;
        const results = resultGetter ? resultGetter(res.data) : res.data;
        dispatch(queryTransactionSuccess(exploreId, transaction.id, results, latency, queries, datasourceId));
      } catch (response) {
        eventBridge.emit('data-error', response);
        dispatch(queryTransactionFailure(exploreId, transaction.id, response, datasourceId));
      }
    });
  };
}

export function scanStart(exploreId: ExploreId, scanner: RangeScanner): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ScanStart, exploreId, scanner });
    const range = scanner();
    dispatch({ type: ActionTypes.ScanRange, exploreId, range });
  };
}

export function scanStop(exploreId: ExploreId): ScanStopAction {
  return { type: ActionTypes.ScanStop, exploreId };
}

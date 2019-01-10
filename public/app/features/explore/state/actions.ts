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
  HistoryItem,
  RangeScanner,
  ResultType,
  QueryOptions,
  QueryTransaction,
  QueryHint,
  QueryHintGetter,
} from 'app/types/explore';
import { Emitter } from 'app/core/core';
import { dispatch } from 'rxjs/internal/observable/pairs';

export enum ActionTypes {
  AddQueryRow = 'ADD_QUERY_ROW',
  ChangeDatasource = 'CHANGE_DATASOURCE',
  ChangeQuery = 'CHANGE_QUERY',
  ChangeSize = 'CHANGE_SIZE',
  ChangeTime = 'CHANGE_TIME',
  ClickClear = 'CLICK_CLEAR',
  ClickExample = 'CLICK_EXAMPLE',
  ClickGraphButton = 'CLICK_GRAPH_BUTTON',
  ClickLogsButton = 'CLICK_LOGS_BUTTON',
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
  index: number;
  query: DataQuery;
}

export interface ChangeQueryAction {
  type: ActionTypes.ChangeQuery;
  query: DataQuery;
  index: number;
  override: boolean;
}

export interface ChangeSizeAction {
  type: ActionTypes.ChangeSize;
  width: number;
  height: number;
}

export interface ChangeTimeAction {
  type: ActionTypes.ChangeTime;
  range: TimeRange;
}

export interface ClickClearAction {
  type: ActionTypes.ClickClear;
}

export interface ClickExampleAction {
  type: ActionTypes.ClickExample;
  query: DataQuery;
}

export interface ClickGraphButtonAction {
  type: ActionTypes.ClickGraphButton;
}

export interface ClickLogsButtonAction {
  type: ActionTypes.ClickLogsButton;
}

export interface ClickTableButtonAction {
  type: ActionTypes.ClickTableButton;
}

export interface InitializeExploreAction {
  type: ActionTypes.InitializeExplore;
  containerWidth: number;
  datasource: string;
  eventBridge: Emitter;
  exploreDatasources: DataSourceSelectItem[];
  queries: DataQuery[];
  range: RawTimeRange;
}

export interface HighlightLogsExpressionAction {
  type: ActionTypes.HighlightLogsExpression;
  expressions: string[];
}

export interface LoadDatasourceFailureAction {
  type: ActionTypes.LoadDatasourceFailure;
  error: string;
}

export interface LoadDatasourcePendingAction {
  type: ActionTypes.LoadDatasourcePending;
  datasourceId: number;
}

export interface LoadDatasourceMissingAction {
  type: ActionTypes.LoadDatasourceMissing;
}

export interface LoadDatasourceSuccessAction {
  type: ActionTypes.LoadDatasourceSuccess;
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
  modification: any;
  index: number;
  modifier: (queries: DataQuery[], modification: any) => DataQuery[];
}

export interface QueryTransactionFailureAction {
  type: ActionTypes.QueryTransactionFailure;
  queryTransactions: QueryTransaction[];
}

export interface QueryTransactionStartAction {
  type: ActionTypes.QueryTransactionStart;
  resultType: ResultType;
  rowIndex: number;
  transaction: QueryTransaction;
}

export interface QueryTransactionSuccessAction {
  type: ActionTypes.QueryTransactionSuccess;
  history: HistoryItem[];
  queryTransactions: QueryTransaction[];
}

export interface RemoveQueryRowAction {
  type: ActionTypes.RemoveQueryRow;
  index: number;
}

export interface ScanStartAction {
  type: ActionTypes.ScanStart;
  scanner: RangeScanner;
}

export interface ScanRangeAction {
  type: ActionTypes.ScanRange;
  range: RawTimeRange;
}

export interface ScanStopAction {
  type: ActionTypes.ScanStop;
}

export type Action =
  | AddQueryRowAction
  | ChangeQueryAction
  | ChangeSizeAction
  | ChangeTimeAction
  | ClickClearAction
  | ClickExampleAction
  | ClickGraphButtonAction
  | ClickLogsButtonAction
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

export function addQueryRow(index: number): AddQueryRowAction {
  const query = generateEmptyQuery(index + 1);
  return { type: ActionTypes.AddQueryRow, index, query };
}

export function changeDatasource(datasource: string): ThunkResult<void> {
  return async dispatch => {
    const instance = await getDatasourceSrv().get(datasource);
    dispatch(loadDatasource(instance));
  };
}

export function changeQuery(query: DataQuery, index: number, override: boolean): ThunkResult<void> {
  return dispatch => {
    // Null query means reset
    if (query === null) {
      query = { ...generateEmptyQuery(index) };
    }

    dispatch({ type: ActionTypes.ChangeQuery, query, index, override });
    if (override) {
      dispatch(runQueries());
    }
  };
}

export function changeSize({ height, width }: { height: number; width: number }): ChangeSizeAction {
  return { type: ActionTypes.ChangeSize, height, width };
}

export function changeTime(range: TimeRange): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ChangeTime, range });
    dispatch(runQueries());
  };
}

export function clickExample(rawQuery: DataQuery): ThunkResult<void> {
  return dispatch => {
    const query = { ...rawQuery, ...generateEmptyQuery() };
    dispatch({
      type: ActionTypes.ClickExample,
      query,
    });
    dispatch(runQueries());
  };
}

export function clickClear(): ThunkResult<void> {
  return dispatch => {
    dispatch(scanStop());
    dispatch({ type: ActionTypes.ClickClear });
    // TODO save state
  };
}

export function clickGraphButton(): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ClickGraphButton });
    if (getState().explore.showingGraph) {
      dispatch(runQueries());
    }
  };
}

export function clickLogsButton(): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ClickLogsButton });
    if (getState().explore.showingLogs) {
      dispatch(runQueries());
    }
  };
}

export function clickTableButton(): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ClickTableButton });
    if (getState().explore.showingTable) {
      dispatch(runQueries());
    }
  };
}

export function highlightLogsExpression(expressions: string[]): HighlightLogsExpressionAction {
  return { type: ActionTypes.HighlightLogsExpression, expressions };
}

export function initializeExplore(
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
      dispatch(loadDatasource(instance));
    } else {
      dispatch(loadDatasourceMissing);
    }
  };
}

export const loadDatasourceFailure = (error: string): LoadDatasourceFailureAction => ({
  type: ActionTypes.LoadDatasourceFailure,
  error,
});

export const loadDatasourceMissing: LoadDatasourceMissingAction = { type: ActionTypes.LoadDatasourceMissing };

export const loadDatasourcePending = (datasourceId: number): LoadDatasourcePendingAction => ({
  type: ActionTypes.LoadDatasourcePending,
  datasourceId,
});

export const loadDatasourceSuccess = (instance: any, queries: DataQuery[]): LoadDatasourceSuccessAction => {
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

export function loadDatasource(instance: any): ThunkResult<void> {
  return async (dispatch, getState) => {
    const datasourceId = instance.meta.id;

    // Keep ID to track selection
    dispatch(loadDatasourcePending(datasourceId));

    let datasourceError = null;
    try {
      const testResult = await instance.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || 'Network error';
    }
    if (datasourceError) {
      dispatch(loadDatasourceFailure(datasourceError));
      return;
    }

    if (datasourceId !== getState().explore.requestedDatasourceId) {
      // User already changed datasource again, discard results
      return;
    }

    if (instance.init) {
      instance.init();
    }

    // Check if queries can be imported from previously selected datasource
    const queries = getState().explore.modifiedQueries;
    let importedQueries = queries;
    const origin = getState().explore.datasourceInstance;
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

    if (datasourceId !== getState().explore.requestedDatasourceId) {
      // User already changed datasource again, discard results
      return;
    }

    // Reset edit state with new queries
    const nextQueries = importedQueries.map((q, i) => ({
      ...importedQueries[i],
      ...generateEmptyQuery(i),
    }));

    dispatch(loadDatasourceSuccess(instance, nextQueries));
    dispatch(runQueries());
  };
}

export function modifyQueries(modification: any, index: number, modifier: any): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ModifyQueries, modification, index, modifier });
    if (!modification.preventSubmit) {
      dispatch(runQueries());
    }
  };
}

export function queryTransactionFailure(transactionId: string, response: any, datasourceId: string): ThunkResult<void> {
  return (dispatch, getState) => {
    const { datasourceInstance, queryTransactions } = getState().explore;
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

    dispatch({ type: ActionTypes.QueryTransactionFailure, queryTransactions: nextQueryTransactions });
  };
}

export function queryTransactionStart(
  transaction: QueryTransaction,
  resultType: ResultType,
  rowIndex: number
): QueryTransactionStartAction {
  return { type: ActionTypes.QueryTransactionStart, resultType, rowIndex, transaction };
}

export function queryTransactionSuccess(
  transactionId: string,
  result: any,
  latency: number,
  queries: DataQuery[],
  datasourceId: string
): ThunkResult<void> {
  return (dispatch, getState) => {
    const { datasourceInstance, history, queryTransactions, scanner, scanning } = getState().explore;

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
      history: nextHistory,
      queryTransactions: nextQueryTransactions,
    });

    // Keep scanning for results if this was the last scanning transaction
    if (scanning) {
      if (_.size(result) === 0) {
        const other = nextQueryTransactions.find(qt => qt.scanning && !qt.done);
        if (!other) {
          const range = scanner();
          dispatch({ type: ActionTypes.ScanRange, range });
        }
      } else {
        // We can stop scanning if we have a result
        dispatch(scanStop());
      }
    }
  };
}

export function removeQueryRow(index: number): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.RemoveQueryRow, index });
    dispatch(runQueries());
  };
}

export function runQueries() {
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
    } = getState().explore;

    if (!hasNonEmptyQuery(modifiedQueries)) {
      dispatch({ type: ActionTypes.RunQueriesEmpty });
      return;
    }

    // Some datasource's query builders allow per-query interval limits,
    // but we're using the datasource interval limit for now
    const interval = datasourceInstance.interval;

    // Keep table queries first since they need to return quickly
    if (showingTable && supportsTable) {
      dispatch(
        runQueriesForType(
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
      dispatch(runQueriesForType('Logs', { interval, format: 'logs' }));
    }
    // TODO save state
  };
}

function runQueriesForType(resultType: ResultType, queryOptions: QueryOptions, resultGetter?: any) {
  return async (dispatch, getState) => {
    const {
      datasourceInstance,
      eventBridge,
      modifiedQueries: queries,
      queryIntervals,
      range,
      scanning,
    } = getState().explore;
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
      dispatch(queryTransactionStart(transaction, resultType, rowIndex));
      try {
        const now = Date.now();
        const res = await datasourceInstance.query(transaction.options);
        eventBridge.emit('data-received', res.data || []);
        const latency = Date.now() - now;
        const results = resultGetter ? resultGetter(res.data) : res.data;
        dispatch(queryTransactionSuccess(transaction.id, results, latency, queries, datasourceId));
      } catch (response) {
        eventBridge.emit('data-error', response);
        dispatch(queryTransactionFailure(transaction.id, response, datasourceId));
      }
    });
  };
}

export function scanStart(scanner: RangeScanner): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ScanStart, scanner });
    const range = scanner();
    dispatch({ type: ActionTypes.ScanRange, range });
  };
}

export function scanStop(): ScanStopAction {
  return { type: ActionTypes.ScanStop };
}

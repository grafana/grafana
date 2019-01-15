import { RawTimeRange, TimeRange } from '@grafana/ui';

import { Emitter } from 'app/core/core';
import {
  ExploreId,
  ExploreItemState,
  HistoryItem,
  RangeScanner,
  ResultType,
  QueryTransaction,
} from 'app/types/explore';
import { DataSourceSelectItem } from 'app/types/datasources';
import { DataQuery } from 'app/types';

export enum ActionTypes {
  AddQueryRow = 'explore/ADD_QUERY_ROW',
  ChangeDatasource = 'explore/CHANGE_DATASOURCE',
  ChangeQuery = 'explore/CHANGE_QUERY',
  ChangeSize = 'explore/CHANGE_SIZE',
  ChangeTime = 'explore/CHANGE_TIME',
  ClearQueries = 'explore/CLEAR_QUERIES',
  HighlightLogsExpression = 'explore/HIGHLIGHT_LOGS_EXPRESSION',
  InitializeExplore = 'explore/INITIALIZE_EXPLORE',
  InitializeExploreSplit = 'explore/INITIALIZE_EXPLORE_SPLIT',
  LoadDatasourceFailure = 'explore/LOAD_DATASOURCE_FAILURE',
  LoadDatasourceMissing = 'explore/LOAD_DATASOURCE_MISSING',
  LoadDatasourcePending = 'explore/LOAD_DATASOURCE_PENDING',
  LoadDatasourceSuccess = 'explore/LOAD_DATASOURCE_SUCCESS',
  ModifyQueries = 'explore/MODIFY_QUERIES',
  QueryTransactionFailure = 'explore/QUERY_TRANSACTION_FAILURE',
  QueryTransactionStart = 'explore/QUERY_TRANSACTION_START',
  QueryTransactionSuccess = 'explore/QUERY_TRANSACTION_SUCCESS',
  RemoveQueryRow = 'explore/REMOVE_QUERY_ROW',
  RunQueries = 'explore/RUN_QUERIES',
  RunQueriesEmpty = 'explore/RUN_QUERIES_EMPTY',
  ScanRange = 'explore/SCAN_RANGE',
  ScanStart = 'explore/SCAN_START',
  ScanStop = 'explore/SCAN_STOP',
  SetQueries = 'explore/SET_QUERIES',
  SplitClose = 'explore/SPLIT_CLOSE',
  SplitOpen = 'explore/SPLIT_OPEN',
  StateSave = 'explore/STATE_SAVE',
  ToggleGraph = 'explore/TOGGLE_GRAPH',
  ToggleLogs = 'explore/TOGGLE_LOGS',
  ToggleTable = 'explore/TOGGLE_TABLE',
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

export interface ClearQueriesAction {
  type: ActionTypes.ClearQueries;
  exploreId: ExploreId;
}

export interface HighlightLogsExpressionAction {
  type: ActionTypes.HighlightLogsExpression;
  exploreId: ExploreId;
  expressions: string[];
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

export interface InitializeExploreSplitAction {
  type: ActionTypes.InitializeExploreSplit;
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

export interface RunQueriesEmptyAction {
  type: ActionTypes.RunQueriesEmpty;
  exploreId: ExploreId;
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

export interface SetQueriesAction {
  type: ActionTypes.SetQueries;
  exploreId: ExploreId;
  queries: DataQuery[];
}

export interface SplitCloseAction {
  type: ActionTypes.SplitClose;
}

export interface SplitOpenAction {
  type: ActionTypes.SplitOpen;
  itemState: ExploreItemState;
}

export interface StateSaveAction {
  type: ActionTypes.StateSave;
}

export interface ToggleTableAction {
  type: ActionTypes.ToggleTable;
  exploreId: ExploreId;
}

export interface ToggleGraphAction {
  type: ActionTypes.ToggleGraph;
  exploreId: ExploreId;
}

export interface ToggleLogsAction {
  type: ActionTypes.ToggleLogs;
  exploreId: ExploreId;
}

export type Action =
  | AddQueryRowAction
  | ChangeQueryAction
  | ChangeSizeAction
  | ChangeTimeAction
  | ClearQueriesAction
  | HighlightLogsExpressionAction
  | InitializeExploreAction
  | InitializeExploreSplitAction
  | LoadDatasourceFailureAction
  | LoadDatasourceMissingAction
  | LoadDatasourcePendingAction
  | LoadDatasourceSuccessAction
  | ModifyQueriesAction
  | QueryTransactionFailureAction
  | QueryTransactionStartAction
  | QueryTransactionSuccessAction
  | RemoveQueryRowAction
  | RunQueriesEmptyAction
  | ScanRangeAction
  | ScanStartAction
  | ScanStopAction
  | SetQueriesAction
  | SplitCloseAction
  | SplitOpenAction
  | ToggleGraphAction
  | ToggleLogsAction
  | ToggleTableAction;

// Types
import { Emitter } from 'app/core/core';
import { RawTimeRange, TimeRange, DataQuery, DataSourceSelectItem, DataSourceApi } from '@grafana/ui/src/types';
import {
  ExploreId,
  ExploreItemState,
  HistoryItem,
  RangeScanner,
  ResultType,
  QueryTransaction,
} from 'app/types/explore';

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
  UpdateDatasourceInstance = 'explore/UPDATE_DATASOURCE_INSTANCE',
  ResetExplore = 'explore/RESET_EXPLORE',
  QueriesImported = 'explore/QueriesImported',
}

export interface AddQueryRowAction {
  type: ActionTypes.AddQueryRow;
  payload: {
    exploreId: ExploreId;
    index: number;
    query: DataQuery;
  };
}

export interface ChangeQueryAction {
  type: ActionTypes.ChangeQuery;
  payload: {
    exploreId: ExploreId;
    query: DataQuery;
    index: number;
    override: boolean;
  };
}

export interface ChangeSizeAction {
  type: ActionTypes.ChangeSize;
  payload: {
    exploreId: ExploreId;
    width: number;
    height: number;
  };
}

export interface ChangeTimeAction {
  type: ActionTypes.ChangeTime;
  payload: {
    exploreId: ExploreId;
    range: TimeRange;
  };
}

export interface ClearQueriesAction {
  type: ActionTypes.ClearQueries;
  payload: {
    exploreId: ExploreId;
  };
}

export interface HighlightLogsExpressionAction {
  type: ActionTypes.HighlightLogsExpression;
  payload: {
    exploreId: ExploreId;
    expressions: string[];
  };
}

export interface InitializeExploreAction {
  type: ActionTypes.InitializeExplore;
  payload: {
    exploreId: ExploreId;
    containerWidth: number;
    eventBridge: Emitter;
    exploreDatasources: DataSourceSelectItem[];
    queries: DataQuery[];
    range: RawTimeRange;
  };
}

export interface InitializeExploreSplitAction {
  type: ActionTypes.InitializeExploreSplit;
}

export interface LoadDatasourceFailureAction {
  type: ActionTypes.LoadDatasourceFailure;
  payload: {
    exploreId: ExploreId;
    error: string;
  };
}

export interface LoadDatasourcePendingAction {
  type: ActionTypes.LoadDatasourcePending;
  payload: {
    exploreId: ExploreId;
    requestedDatasourceName: string;
  };
}

export interface LoadDatasourceMissingAction {
  type: ActionTypes.LoadDatasourceMissing;
  payload: {
    exploreId: ExploreId;
  };
}

export interface LoadDatasourceSuccessAction {
  type: ActionTypes.LoadDatasourceSuccess;
  payload: {
    exploreId: ExploreId;
    StartPage?: any;
    datasourceInstance: any;
    history: HistoryItem[];
    logsHighlighterExpressions?: any[];
    showingStartPage: boolean;
    supportsGraph: boolean;
    supportsLogs: boolean;
    supportsTable: boolean;
  };
}

export interface ModifyQueriesAction {
  type: ActionTypes.ModifyQueries;
  payload: {
    exploreId: ExploreId;
    modification: any;
    index: number;
    modifier: (queries: DataQuery[], modification: any) => DataQuery[];
  };
}

export interface QueryTransactionFailureAction {
  type: ActionTypes.QueryTransactionFailure;
  payload: {
    exploreId: ExploreId;
    queryTransactions: QueryTransaction[];
  };
}

export interface QueryTransactionStartAction {
  type: ActionTypes.QueryTransactionStart;
  payload: {
    exploreId: ExploreId;
    resultType: ResultType;
    rowIndex: number;
    transaction: QueryTransaction;
  };
}

export interface QueryTransactionSuccessAction {
  type: ActionTypes.QueryTransactionSuccess;
  payload: {
    exploreId: ExploreId;
    history: HistoryItem[];
    queryTransactions: QueryTransaction[];
  };
}

export interface RemoveQueryRowAction {
  type: ActionTypes.RemoveQueryRow;
  payload: {
    exploreId: ExploreId;
    index: number;
  };
}

export interface RunQueriesEmptyAction {
  type: ActionTypes.RunQueriesEmpty;
  payload: {
    exploreId: ExploreId;
  };
}

export interface ScanStartAction {
  type: ActionTypes.ScanStart;
  payload: {
    exploreId: ExploreId;
    scanner: RangeScanner;
  };
}

export interface ScanRangeAction {
  type: ActionTypes.ScanRange;
  payload: {
    exploreId: ExploreId;
    range: RawTimeRange;
  };
}

export interface ScanStopAction {
  type: ActionTypes.ScanStop;
  payload: {
    exploreId: ExploreId;
  };
}

export interface SetQueriesAction {
  type: ActionTypes.SetQueries;
  payload: {
    exploreId: ExploreId;
    queries: DataQuery[];
  };
}

export interface SplitCloseAction {
  type: ActionTypes.SplitClose;
}

export interface SplitOpenAction {
  type: ActionTypes.SplitOpen;
  payload: {
    itemState: ExploreItemState;
  };
}

export interface StateSaveAction {
  type: ActionTypes.StateSave;
}

export interface ToggleTableAction {
  type: ActionTypes.ToggleTable;
  payload: {
    exploreId: ExploreId;
  };
}

export interface ToggleGraphAction {
  type: ActionTypes.ToggleGraph;
  payload: {
    exploreId: ExploreId;
  };
}

export interface ToggleLogsAction {
  type: ActionTypes.ToggleLogs;
  payload: {
    exploreId: ExploreId;
  };
}

export interface UpdateDatasourceInstanceAction {
  type: ActionTypes.UpdateDatasourceInstance;
  payload: {
    exploreId: ExploreId;
    datasourceInstance: DataSourceApi;
  };
}

export interface ResetExploreAction {
  type: ActionTypes.ResetExplore;
  payload: {};
}

export interface QueriesImported {
  type: ActionTypes.QueriesImported;
  payload: {
    exploreId: ExploreId;
    queries: DataQuery[];
  };
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
  | ToggleTableAction
  | UpdateDatasourceInstanceAction
  | ResetExploreAction
  | QueriesImported;

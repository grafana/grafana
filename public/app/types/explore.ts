import { Observable, SubscriptionLike, Unsubscribable } from 'rxjs';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  HistoryItem,
  LogsModel,
  PanelData,
  RawTimeRange,
  TimeRange,
  EventBusExtended,
  DataQueryResponse,
  ExplorePanelsState,
  SupplementaryQueryType,
  UrlQueryMap,
  ExploreCorrelationHelperData,
  DataLinkTransformationConfig,
} from '@grafana/data';
import { CorrelationData } from '@grafana/runtime';
import { RichHistorySearchFilters, RichHistorySettings } from 'app/core/utils/richHistoryTypes';

export type ExploreQueryParams = UrlQueryMap;

export enum CORRELATION_EDITOR_POST_CONFIRM_ACTION {
  CLOSE_PANE,
  CHANGE_DATASOURCE,
  CLOSE_EDITOR,
}

export interface CorrelationEditorDetails {
  editorMode: boolean;
  correlationDirty: boolean;
  queryEditorDirty: boolean;
  isExiting: boolean;
  postConfirmAction?: {
    // perform an action after a confirmation modal instead of exiting editor mode
    exploreId: string;
    action: CORRELATION_EDITOR_POST_CONFIRM_ACTION;
    changeDatasourceUid?: string;
    isActionLeft: boolean;
  };
  canSave?: boolean;
  label?: string;
  description?: string;
  transformations?: DataLinkTransformationConfig[];
}

// updates can have any properties
export interface CorrelationEditorDetailsUpdate extends Partial<CorrelationEditorDetails> {}

/**
 * Global Explore state
 */
export interface ExploreState {
  /**
   * True if time interval for panels are synced. Only possible with split mode.
   */
  syncedTimes: boolean;

  panes: Record<string, ExploreItemState | undefined>;

  /**
   * History of all queries
   */
  richHistory: RichHistoryQuery[];
  richHistorySearchFilters?: RichHistorySearchFilters;
  richHistoryTotal?: number;

  /**
   * Settings for rich history (note: filters are stored per each pane separately)
   */
  richHistorySettings?: RichHistorySettings;

  /**
   * True if local storage quota was exceeded when a rich history item was added. This is to prevent showing
   * multiple errors when local storage is full.
   */
  richHistoryStorageFull: boolean;

  /**
   * True if a warning message of hitting the exceeded number of items has been shown already.
   */
  richHistoryLimitExceededWarningShown: boolean;

  /**
   * Details on a correlation being created from explore
   */
  correlationEditorDetails?: CorrelationEditorDetails;

  /**
   * On a split manual resize, we calculate which pane is larger, or if they are roughly the same size. If undefined, it is not split or they are roughly the same size
   */
  largerExploreId?: keyof ExploreState['panes'];

  /**
   * If a maximize pane button is pressed, this indicates which side was maximized. Will be undefined if not split or if it is manually resized
   */
  maxedExploreId?: keyof ExploreState['panes'];

  /**
   * If a minimize pane button is pressed, it will do an even split of panes. Will be undefined if split or on a manual resize
   */
  evenSplitPanes?: boolean;
}

export const EXPLORE_GRAPH_STYLES = ['lines', 'bars', 'points', 'stacked_lines', 'stacked_bars'] as const;
export type ExploreGraphStyle = (typeof EXPLORE_GRAPH_STYLES)[number];

export interface ExploreItemState {
  /**
   * Width used for calculating the graph interval (can't have more datapoints than pixels)
   */
  containerWidth: number;
  /**
   * Datasource instance that has been selected. Datasource-specific logic can be run on this object.
   */
  datasourceInstance?: DataSourceApi | null;
  /**
   * Emitter to send events to the rest of Grafana.
   */
  eventBridge: EventBusExtended;
  /**
   * List of timeseries to be shown in the Explore graph result viewer.
   */
  graphResult: DataFrame[] | null;
  /**
   * History of recent queries. Datasource-specific and initialized via localStorage.
   */
  history: HistoryItem[];
  /**
   * Queries for this Explore, e.g., set via URL. Each query will be
   * converted to a query row.
   */
  queries: DataQuery[];
  /**
   * True if this Explore area has been initialized.
   * Used to distinguish URL state injection versus split view state injection.
   */
  initialized: boolean;
  /**
   * Log query result to be displayed in the logs result viewer.
   */
  logsResult: LogsModel | null;

  /**
   * Time range for this Explore. Managed by the time picker and used by all query runs.
   */
  range: TimeRange;

  absoluteRange: AbsoluteTimeRange;
  /**
   * True if scanning for more results is active.
   */
  scanning: boolean;
  /**
   * Current scanning range to be shown to the user while scanning is active.
   */
  scanRange?: RawTimeRange;

  /**
   * Table model that combines all query table results into a single table.
   */
  tableResult: DataFrame[] | null;

  /**
   * Simple UI that emulates native prometheus UI
   */
  rawPrometheusResult: DataFrame | null;

  /**
   * React keys for rendering of QueryRows
   */
  queryKeys: string[];

  /**
   * How often query should be refreshed
   */
  refreshInterval?: string;

  /**
   * If true, the view is in live tailing mode.
   */
  isLive: boolean;

  /**
   * If true, the live tailing view is paused.
   */
  isPaused: boolean;

  /**
   * Index of the last item in the list of logs
   * when the live tailing views gets cleared.
   */
  clearedAtIndex: number | null;

  querySubscription?: Unsubscribable;

  queryResponse: ExplorePanelData;

  showLogs?: boolean;
  showMetrics?: boolean;
  showTable?: boolean;
  /**
   * If true, the default "raw" prometheus instant query UI will be displayed in addition to table view
   */
  showRawPrometheus?: boolean;
  showTrace?: boolean;
  showNodeGraph?: boolean;
  showFlameGraph?: boolean;
  showCustom?: boolean;

  /**
   * We are using caching to store query responses of queries run from logs navigation.
   * In logs navigation, we do pagination and we don't want our users to unnecessarily run the same queries that they've run just moments before.
   * We are currently caching last 5 query responses.
   */
  cache: Array<{ key: string; value: ExplorePanelData }>;

  /**
   * Supplementary queries are additional queries used in Explore, e.g. for logs volume
   */
  supplementaryQueries: SupplementaryQueries;

  panelsState: ExplorePanelsState;

  correlationEditorHelperData?: ExploreCorrelationHelperData;

  correlations?: CorrelationData[];
}

export interface ExploreUpdateState {
  datasource: boolean;
  queries: boolean;
  range: boolean;
  mode: boolean;
}

export interface QueryOptions {
  minInterval?: string;
  maxDataPoints?: number;
  liveStreaming?: boolean;
}

export interface QueryTransaction {
  id: string;
  done: boolean;
  request: DataQueryRequest;
  queries: DataQuery[];
  scanning?: boolean;
}

export type RichHistoryQuery<T extends DataQuery = DataQuery> = {
  id: string;
  createdAt: number;
  datasourceUid: string;
  datasourceName: string;
  starred: boolean;
  comment: string;
  queries: T[];
};

export interface ExplorePanelData extends PanelData {
  graphFrames: DataFrame[];
  tableFrames: DataFrame[];
  logsFrames: DataFrame[];
  traceFrames: DataFrame[];
  customFrames: DataFrame[];
  nodeGraphFrames: DataFrame[];
  rawPrometheusFrames: DataFrame[];
  flameGraphFrames: DataFrame[];
  graphResult: DataFrame[] | null;
  tableResult: DataFrame[] | null;
  logsResult: LogsModel | null;
  rawPrometheusResult: DataFrame | null;
}

export enum TABLE_RESULTS_STYLE {
  table = 'table',
  raw = 'raw',
}
export const TABLE_RESULTS_STYLES = [TABLE_RESULTS_STYLE.table, TABLE_RESULTS_STYLE.raw];
export type TableResultsStyle = (typeof TABLE_RESULTS_STYLES)[number];

export interface SupplementaryQuery {
  enabled: boolean;
  dataProvider?: Observable<DataQueryResponse>;
  dataSubscription?: SubscriptionLike;
  data?: DataQueryResponse;
}

export type SupplementaryQueries = {
  [key in SupplementaryQueryType]: SupplementaryQuery;
};

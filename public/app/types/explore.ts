import { Observable, SubscriptionLike, Unsubscribable } from 'rxjs';
import {
  AbsoluteTimeRange,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  EventBusExtended,
  HistoryItem,
  LogsModel,
  PanelData,
  QueryHint,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';

export enum ExploreId {
  left = 'left',
  right = 'right',
}

export type ExploreQueryParams = {
  left: string;
  right: string;
};

/**
 * Global Explore state
 */
export interface ExploreState {
  /**
   * True if time interval for panels are synced. Only possible with split mode.
   */
  syncedTimes: boolean;
  /**
   * Explore state of the left split (left is default in non-split view).
   */
  left: ExploreItemState;
  /**
   * Explore state of the right area in split view.
   */
  right?: ExploreItemState;
  /**
   * History of all queries
   */
  richHistory: RichHistoryQuery[];

  /**
   * True if local storage quota was exceeded when a new item was added. This is to prevent showing
   * multiple errors when local storage is full.
   */
  localStorageFull: boolean;

  /**
   * True if a warning message of hitting the exceeded number of items has been shown already.
   */
  richHistoryLimitExceededWarningShown: boolean;
}

export const EXPLORE_GRAPH_STYLES = ['lines', 'bars', 'points', 'stacked_lines', 'stacked_bars'] as const;
export type ExploreGraphStyle = typeof EXPLORE_GRAPH_STYLES[number];

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
   * True if there is no datasource to be selected.
   */
  datasourceMissing: boolean;
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

  loading: boolean;
  /**
   * Table model that combines all query table results into a single table.
   */
  tableResult: DataFrame | null;

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

  querySubscription?: Unsubscribable;

  queryResponse: PanelData;

  /**
   * Panel Id that is set if we come to explore from a penel. Used so we can get back to it and optionally modify the
   * query of that panel.
   */
  originPanelId?: number | null;

  showLogs?: boolean;
  showMetrics?: boolean;
  showTable?: boolean;
  showTrace?: boolean;
  showNodeGraph?: boolean;

  /**
   * We are using caching to store query responses of queries run from logs navigation.
   * In logs navigation, we do pagination and we don't want our users to unnecessarily run the same queries that they've run just moments before.
   * We are currently caching last 5 query responses.
   */
  cache: Array<{ key: string; value: PanelData }>;

  // properties below should be more generic if we add more providers
  // see also: DataSourceWithLogsVolumeSupport
  logsVolumeDataProvider?: Observable<DataQueryResponse>;
  logsVolumeDataSubscription?: SubscriptionLike;
  logsVolumeData?: DataQueryResponse;

  /* explore graph style */
  graphStyle: ExploreGraphStyle;
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
  error?: string | JSX.Element;
  hints?: QueryHint[];
  request: DataQueryRequest;
  queries: DataQuery[];
  result?: any; // Table model / Timeseries[] / Logs
  scanning?: boolean;
}

export type RichHistoryQuery = {
  ts: number;
  datasourceName: string;
  datasourceId: string;
  starred: boolean;
  comment: string;
  queries: DataQuery[];
  sessionName: string;
  timeRange?: string;
};

export interface ExplorePanelData extends PanelData {
  graphFrames: DataFrame[];
  tableFrames: DataFrame[];
  logsFrames: DataFrame[];
  traceFrames: DataFrame[];
  nodeGraphFrames: DataFrame[];
  graphResult: DataFrame[] | null;
  tableResult: DataFrame | null;
  logsResult: LogsModel | null;
}

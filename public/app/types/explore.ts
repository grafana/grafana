import { Unsubscribable } from 'rxjs';
import {
  AbsoluteTimeRange,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  ExploreUrlState,
  GraphSeriesXY,
  HistoryItem,
  LogLevel,
  LogsDedupStrategy,
  LogsModel,
  PanelData,
  QueryHint,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';

import { Emitter } from 'app/core/core';

export enum ExploreId {
  left = 'left',
  right = 'right',
}

/**
 * Global Explore state
 */
export interface ExploreState {
  /**
   * True if split view is active.
   */
  split: boolean;
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
  right: ExploreItemState;
  /**
   * History of all queries
   */
  richHistory: RichHistoryQuery[];
}

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
   * Current data source name or null if default
   */
  requestedDatasourceName: string | null;
  /**
   * True if the datasource is loading. `null` if the loading has not started yet.
   */
  datasourceLoading: boolean | null;
  /**
   * True if there is no datasource to be selected.
   */
  datasourceMissing: boolean;
  /**
   * Emitter to send events to the rest of Grafana.
   */
  eventBridge: Emitter;
  /**
   * List of timeseries to be shown in the Explore graph result viewer.
   */
  graphResult: GraphSeriesXY[] | null;
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
   * Log line substrings to be highlighted as you type in a query field.
   * Currently supports only the first query row.
   */
  logsHighlighterExpressions?: string[];
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
   * Current logs deduplication strategy
   */
  dedupStrategy: LogsDedupStrategy;

  /**
   * Currently hidden log series
   */
  hiddenLogLevels?: LogLevel[];

  /**
   * How often query should be refreshed
   */
  refreshInterval?: string;

  /**
   * Copy of the state of the URL which is in store.location.query. This is duplicated here so we can diff the two
   * after a change to see if we need to sync url state back to redux store (like on clicking Back in browser).
   */
  urlState: ExploreUrlState | null;

  /**
   * Map of what changed between real url and local urlState so we can partially update just the things that are needed.
   */
  update: ExploreUpdateState;

  latency: number;

  /**
   * If true, the view is in live tailing mode.
   */
  isLive: boolean;

  /**
   * If true, the live tailing view is paused.
   */
  isPaused: boolean;
  urlReplaced: boolean;

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
  latency: number;
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
  graphResult: GraphSeriesXY[] | null;
  tableResult: DataFrame | null;
  logsResult: LogsModel | null;
}

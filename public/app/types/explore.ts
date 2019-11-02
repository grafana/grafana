import { Unsubscribable } from 'rxjs';
import { ComponentType } from 'react';
import {
  HistoryItem,
  DataQuery,
  DataSourceSelectItem,
  DataSourceApi,
  QueryHint,
  ExploreStartPageProps,
  PanelData,
  DataQueryRequest,
  RawTimeRange,
  LogLevel,
  TimeRange,
  LogsModel,
  LogsDedupStrategy,
  AbsoluteTimeRange,
  GraphSeriesXY,
} from '@grafana/data';

import { Emitter } from 'app/core/core';
import TableModel from 'app/core/table_model';

export enum ExploreMode {
  Metrics = 'Metrics',
  Logs = 'Logs',
}

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
}

export interface ExploreItemState {
  /**
   * React component to be shown when no queries have been run yet, e.g., for a query language cheat sheet.
   */
  StartPage?: ComponentType<ExploreStartPageProps>;
  /**
   * Width used for calculating the graph interval (can't have more datapoints than pixels)
   */
  containerWidth: number;
  /**
   * Datasource instance that has been selected. Datasource-specific logic can be run on this object.
   */
  datasourceInstance: DataSourceApi | null;
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
  eventBridge?: Emitter;
  /**
   * List of datasources to be shown in the datasource selector.
   */
  exploreDatasources: DataSourceSelectItem[];
  /**
   * List of timeseries to be shown in the Explore graph result viewer.
   */
  graphResult?: GraphSeriesXY[];
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
  logsResult?: LogsModel;

  /**
   * Time range for this Explore. Managed by the time picker and used by all query runs.
   */
  range: TimeRange;

  absoluteRange: AbsoluteTimeRange;
  /**
   * True if scanning for more results is active.
   */
  scanning?: boolean;
  /**
   * Current scanning range to be shown to the user while scanning is active.
   */
  scanRange?: RawTimeRange;
  /**
   * True if graph result viewer is expanded. Query runs will contain graph queries.
   */
  showingGraph: boolean;
  /**
   * True StartPage needs to be shown. Typically set to `false` once queries have been run.
   */
  showingStartPage?: boolean;
  /**
   * True if table result viewer is expanded. Query runs will contain table queries.
   */
  showingTable: boolean;

  loading: boolean;
  /**
   * Table model that combines all query table results into a single table.
   */
  tableResult?: TableModel;

  /**
   * React keys for rendering of QueryRows
   */
  queryKeys: string[];

  /**
   * Current logs deduplication strategy
   */
  dedupStrategy?: LogsDedupStrategy;

  /**
   * Currently hidden log series
   */
  hiddenLogLevels?: LogLevel[];

  /**
   * How often query should be refreshed
   */
  refreshInterval?: string;

  urlState: ExploreUrlState;

  update: ExploreUpdateState;

  latency: number;
  supportedModes: ExploreMode[];
  mode: ExploreMode;

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
  originPanelId?: number;
}

export interface ExploreUpdateState {
  datasource: boolean;
  queries: boolean;
  range: boolean;
  mode: boolean;
  ui: boolean;
}

export interface ExploreUIState {
  showingTable: boolean;
  showingGraph: boolean;
  showingLogs: boolean;
  dedupStrategy?: LogsDedupStrategy;
}

export interface ExploreUrlState {
  datasource: string;
  queries: any[]; // Should be a DataQuery, but we're going to strip refIds, so typing makes less sense
  mode: ExploreMode;
  range: RawTimeRange;
  ui: ExploreUIState;
  originPanelId?: number;
  context?: string;
}

export interface QueryIntervals {
  interval: string;
  intervalMs: number;
}

export interface QueryOptions {
  minInterval: string;
  maxDataPoints?: number;
  liveStreaming?: boolean;
  showingGraph?: boolean;
  showingTable?: boolean;
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

import { Observable } from 'rxjs';

import { DataQuery, LogsSortOrder } from '@grafana/schema';

import { BusEventWithPayload } from '../events/types';

import { ScopedVars } from './ScopedVars';
import { KeyValue, Labels } from './data';
import { DataFrame } from './dataFrame';
import { DataQueryRequest, DataQueryResponse, DataSourceApi, QueryFixAction, QueryFixType } from './datasource';
import { AbsoluteTimeRange } from './time';
export { LogsDedupStrategy, LogsSortOrder } from '@grafana/schema';

/**
 * Mapping of log level abbreviation to canonical log level.
 * Supported levels are reduce to limit color variation.
 */
export enum LogLevel {
  emerg = 'critical',
  fatal = 'critical',
  alert = 'critical',
  crit = 'critical',
  critical = 'critical',
  warn = 'warning',
  warning = 'warning',
  err = 'error',
  eror = 'error',
  error = 'error',
  info = 'info',
  information = 'info',
  informational = 'info',
  notice = 'info',
  dbug = 'debug',
  debug = 'debug',
  trace = 'trace',
  unknown = 'unknown',
}

/**
 * Mapping of log level abbreviation to canonical log level.
 * Supported levels are reduce to limit color variation.
 */
export const NumericLogLevel: Record<string, LogLevel> = {
  '0': LogLevel.critical,
  '1': LogLevel.critical,
  '2': LogLevel.critical,
  '3': LogLevel.error,
  '4': LogLevel.warning,
  '5': LogLevel.info,
  '6': LogLevel.info,
  '7': LogLevel.debug,
};

// Used for meta information such as common labels or returned log rows in logs view in Explore
export enum LogsMetaKind {
  Number,
  String,
  LabelsMap,
  Error,
}

export interface LogsMetaItem {
  label: string;
  value: string | number | Labels;
  kind: LogsMetaKind;
}

export interface LogRowModel {
  // Index of the field from which the entry has been created so that we do not show it later in log row details.
  entryFieldIndex: number;

  // Index of the row in the dataframe. As log rows can be stitched from multiple dataFrames, this does not have to be
  // the same as rows final index when rendered.
  rowIndex: number;

  // The value of the dataframe's id field, if it exists
  rowId?: string;

  // Full DataFrame from which we parsed this log.
  // TODO: refactor this so we do not need to pass whole dataframes in addition to also parsed data.
  dataFrame: DataFrame;
  duplicates?: number;

  // Actual log line
  entry: string;
  hasAnsi: boolean;
  hasUnescapedContent: boolean;
  labels: Labels;
  logLevel: LogLevel;
  raw: string;
  searchWords?: string[];
  timeFromNow: string;
  timeEpochMs: number;
  // timeEpochNs stores time with nanosecond-level precision,
  // as millisecond-level precision is usually not enough for proper sorting of logs
  timeEpochNs: string;
  timeLocal: string;
  timeUtc: string;
  uid: string;
  uniqueLabels?: Labels;
  datasourceType?: string;
  datasourceUid?: string;
}

export interface LogsModel {
  hasUniqueLabels: boolean;
  meta?: LogsMetaItem[];
  rows: LogRowModel[];
  series?: DataFrame[];
  // visibleRange is time range for histogram created from log results
  visibleRange?: AbsoluteTimeRange;
  queries?: DataQuery[];
  bucketSize?: number;
}

export interface LogSearchMatch {
  start: number;
  length: number;
  text: string;
}

export interface LogLabelStatsModel {
  active?: boolean;
  count: number;
  proportion: number;
  value: string;
}

export enum LogsDedupDescription {
  none = 'No de-duplication',
  exact = 'De-duplication of successive lines that are identical, ignoring ISO datetimes.',
  numbers = 'De-duplication of successive lines that are identical when ignoring numbers, e.g., IP addresses, latencies.',
  signature = 'De-duplication of successive lines that have identical punctuation and whitespace.',
}

export interface LogRowContextOptions {
  direction?: LogRowContextQueryDirection;
  limit?: number;
  scopedVars?: ScopedVars;
  // Optional. Size of the time window to get logs before of after the referenced entry.
  timeWindowMs?: number;
}

export enum LogRowContextQueryDirection {
  Backward = 'BACKWARD',
  Forward = 'FORWARD',
}

/**
 * Data sources that allow showing context rows around the provided LowRowModel should implement this method.
 * This will enable "context" button in Logs Panel.
 */
export interface DataSourceWithLogsContextSupport<TQuery extends DataQuery = DataQuery> {
  /**
   * Retrieve context for a given log row
   */
  getLogRowContext: (row: LogRowModel, options?: LogRowContextOptions, query?: TQuery) => Promise<DataQueryResponse>;

  /**
   * Retrieve the context query object for a given log row. This is currently used to open LogContext queries in a split view and in a new browser tab.
   * The `cacheFilters` parameter can be used to force a refetch of the cached applied filters. Default value `true`.
   */
  getLogRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    query?: TQuery,
    cacheFilters?: boolean
  ) => Promise<TQuery | null>;

  /**
   * @deprecated Deprecated since 10.3. To display the context option and support the feature implement DataSourceWithLogsContextSupport interface instead.
   */
  showContextToggle?(row?: LogRowModel): boolean;

  /**
   * This method can be used to display a custom UI in the context view.
   * @alpha
   * @internal
   */
  getLogRowContextUi?(
    row: LogRowModel,
    runContextQuery?: () => void,
    origQuery?: TQuery,
    scopedVars?: ScopedVars
  ): React.ReactNode;
}

export const hasLogsContextSupport = (datasource: unknown): datasource is DataSourceWithLogsContextSupport => {
  if (!datasource || typeof datasource !== 'object') {
    return false;
  }

  return 'getLogRowContext' in datasource;
};

/**
 * Types of supplementary queries that can be run in Explore.
 * @internal
 */
export enum SupplementaryQueryType {
  LogsVolume = 'LogsVolume',
  LogsSample = 'LogsSample',
}

/**
 * @internal
 */
export type SupplementaryQueryOptions = LogsVolumeOption | LogsSampleOptions;

/**
 * @internal
 */
export type LogsVolumeOption = {
  type: SupplementaryQueryType.LogsVolume;
  field?: string;
};

/**
 * @internal
 */
export type LogsSampleOptions = {
  type: SupplementaryQueryType.LogsSample;
  limit?: number;
};

/**
 * Types of logs volume responses. A data source may return full range histogram (based on selected range)
 * or limited (based on returned results). This information is attached to DataFrame.meta.custom object.
 * @internal
 */
export enum LogsVolumeType {
  FullRange = 'FullRange',
  Limited = 'Limited',
}

/**
 * Custom meta information required by Logs Volume responses
 */
export type LogsVolumeCustomMetaData = {
  absoluteRange: AbsoluteTimeRange;
  logsVolumeType: LogsVolumeType;
  datasourceName: string;
  sourceQuery: DataQuery;
};

/**
 * Data sources that support supplementary queries in Explore.
 * This will enable users to see additional data when running original queries.
 * Supported supplementary queries are defined in SupplementaryQueryType enum.
 */
export interface DataSourceWithSupplementaryQueriesSupport<TQuery extends DataQuery> {
  /**
   * Returns an observable that will be used to fetch supplementary data based on the provided
   * supplementary query type and original request.
   * @deprecated Use getSupplementaryQueryRequest() instead
   */
  getDataProvider?(
    type: SupplementaryQueryType,
    request: DataQueryRequest<TQuery>
  ): Observable<DataQueryResponse> | undefined;
  /**
   * Receives a SupplementaryQueryType and a DataQueryRequest and returns a new DataQueryRequest to fetch supplementary data.
   * If provided type or request is not suitable for a supplementary data request, returns undefined.
   */
  getSupplementaryRequest?(
    type: SupplementaryQueryType,
    request: DataQueryRequest<TQuery>,
    options?: SupplementaryQueryOptions
  ): DataQueryRequest<TQuery> | undefined;
  /**
   * Returns supplementary query types that data source supports.
   */
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[];
  /**
   * Returns a supplementary query to be used to fetch supplementary data based on the provided type and original query.
   * If the provided query is not suitable for the provided supplementary query type, undefined should be returned.
   */
  getSupplementaryQuery(options: SupplementaryQueryOptions, originalQuery: TQuery): TQuery | undefined;
}

export const hasSupplementaryQuerySupport = <TQuery extends DataQuery>(
  datasource: DataSourceApi | (DataSourceApi & DataSourceWithSupplementaryQueriesSupport<TQuery>),
  type: SupplementaryQueryType
): datasource is DataSourceApi & DataSourceWithSupplementaryQueriesSupport<TQuery> => {
  if (!datasource) {
    return false;
  }

  return (
    ('getDataProvider' in datasource || 'getSupplementaryRequest' in datasource) &&
    'getSupplementaryQuery' in datasource &&
    'getSupportedSupplementaryQueryTypes' in datasource &&
    datasource.getSupportedSupplementaryQueryTypes().includes(type)
  );
};

export const hasLogsContextUiSupport = (datasource: unknown): datasource is DataSourceWithLogsContextSupport => {
  if (!datasource || typeof datasource !== 'object') {
    return false;
  }

  return 'getLogRowContextUi' in datasource;
};

export interface QueryFilterOptions extends KeyValue<string> {}
export interface ToggleFilterAction {
  type: 'FILTER_FOR' | 'FILTER_OUT';
  options: QueryFilterOptions;
  frame?: DataFrame;
}
/**
 * Data sources that support toggleable filters through `toggleQueryFilter`, and displaying the active
 * state of filters through `queryHasFilter`, in the Log Details component in Explore.
 * @internal
 * @alpha
 */
export interface DataSourceWithToggleableQueryFiltersSupport<TQuery extends DataQuery> {
  /**
   * Toggle filters on and off from query.
   * If the filter is already present, it should be removed.
   * If the opposite filter is present, it should be replaced.
   */
  toggleQueryFilter(query: TQuery, filter: ToggleFilterAction): TQuery;

  /**
   * Given a query, determine if it has a filter that matches the options.
   */
  queryHasFilter(query: TQuery, filter: QueryFilterOptions): boolean;
}

/**
 * @internal
 */
export const hasToggleableQueryFiltersSupport = <TQuery extends DataQuery>(
  datasource: unknown
): datasource is DataSourceWithToggleableQueryFiltersSupport<TQuery> => {
  return (
    datasource != null &&
    typeof datasource === 'object' &&
    'toggleQueryFilter' in datasource &&
    'queryHasFilter' in datasource
  );
};

/**
 * Data sources that support query modification actions from Log Details (ADD_FILTER, ADD_FILTER_OUT),
 * and Popover Menu (ADD_STRING_FILTER, ADD_STRING_FILTER_OUT) in Explore.
 * @internal
 * @alpha
 */
export interface DataSourceWithQueryModificationSupport<TQuery extends DataQuery> {
  /**
   * Given a query, applies a query modification `action`, returning the updated query.
   * Explore currently supports the following action types:
   * - ADD_FILTER: adds a <key, value> filter to the query.
   * - ADD_FILTER_OUT: adds a negative <key, value> filter to the query.
   * - ADD_STRING_FILTER: adds a string filter to the query.
   * - ADD_STRING_FILTER_OUT: adds a negative string filter to the query.
   */
  modifyQuery(query: TQuery, action: QueryFixAction): TQuery;

  /**
   * Returns a list of supported action types for `modifyQuery()`.
   */
  getSupportedQueryModifications(): Array<QueryFixType | string>;
}

/**
 * @internal
 */
export const hasQueryModificationSupport = <TQuery extends DataQuery>(
  datasource: unknown
): datasource is DataSourceWithQueryModificationSupport<TQuery> => {
  return (
    datasource != null &&
    typeof datasource === 'object' &&
    'modifyQuery' in datasource &&
    'getSupportedQueryModifications' in datasource
  );
};

export interface LogSortOrderChangePayload {
  order: LogsSortOrder;
}

export class LogSortOrderChangeEvent extends BusEventWithPayload<LogSortOrderChangePayload> {
  static type = 'logs-sort-order-change';
}

import { Observable } from 'rxjs';

import { Labels } from './data';
import { DataFrame } from './dataFrame';
import { DataQueryRequest, DataQueryResponse } from './datasource';
import { DataQuery } from './query';
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
   * This method can be used to show "context" button based on runtime conditions (for example row model data or plugin settings, etc.)
   */
  showContextToggle(row?: LogRowModel): boolean;

  /**
   * This method can be used to display a custom UI in the context view.
   * @alpha
   * @internal
   */
  getLogRowContextUi?(row: LogRowModel, runContextQuery?: () => void): React.ReactNode;
}

export const hasLogsContextSupport = (datasource: unknown): datasource is DataSourceWithLogsContextSupport => {
  if (!datasource) {
    return false;
  }

  const withLogsSupport = datasource as DataSourceWithLogsContextSupport;

  return withLogsSupport.getLogRowContext !== undefined && withLogsSupport.showContextToggle !== undefined;
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
 * @internal
 */
export interface DataSourceWithSupplementaryQueriesSupport<TQuery extends DataQuery> {
  /**
   * Returns an observable that will be used to fetch supplementary data based on the provided
   * supplementary query type and original request.
   */
  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<TQuery>
  ): Observable<DataQueryResponse> | undefined;
  /**
   * Returns supplementary query types that data source supports.
   */
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[];
  /**
   * Returns a supplementary query to be used to fetch supplementary data based on the provided type and original query.
   * If provided query is not suitable for provided supplementary query type, undefined should be returned.
   */
  getSupplementaryQuery(type: SupplementaryQueryType, query: TQuery): TQuery | undefined;
}

export const hasSupplementaryQuerySupport = <TQuery extends DataQuery>(
  datasource: unknown,
  type: SupplementaryQueryType
): datasource is DataSourceWithSupplementaryQueriesSupport<TQuery> => {
  if (!datasource) {
    return false;
  }

  const withSupplementaryQueriesSupport = datasource as DataSourceWithSupplementaryQueriesSupport<TQuery>;

  return (
    withSupplementaryQueriesSupport.getDataProvider !== undefined &&
    withSupplementaryQueriesSupport.getSupplementaryQuery !== undefined &&
    withSupplementaryQueriesSupport.getSupportedSupplementaryQueryTypes().includes(type)
  );
};

export const hasLogsContextUiSupport = (datasource: unknown): datasource is DataSourceWithLogsContextSupport => {
  if (!datasource) {
    return false;
  }

  const withLogsSupport = datasource as DataSourceWithLogsContextSupport;

  return withLogsSupport.getLogRowContextUi !== undefined;
};

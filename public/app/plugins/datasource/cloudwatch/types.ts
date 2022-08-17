import { AwsAuthDataSourceJsonData, AwsAuthDataSourceSecureJsonData } from '@grafana/aws-sdk';
import { DataQuery, DataSourceRef, SelectableValue } from '@grafana/data';

import {
  QueryEditorArrayExpression,
  QueryEditorFunctionExpression,
  QueryEditorPropertyExpression,
} from './expressions';

export interface Dimensions {
  [key: string]: string | string[];
}

export interface MultiFilters {
  [key: string]: string[];
}

export type CloudWatchQueryMode = 'Metrics' | 'Logs' | 'Annotations';

export enum MetricQueryType {
  'Search',
  'Query',
}

export enum MetricEditorMode {
  'Builder',
  'Code',
}

export type Direction = 'ASC' | 'DESC';

export interface SQLExpression {
  select?: QueryEditorFunctionExpression;
  from?: QueryEditorPropertyExpression | QueryEditorFunctionExpression;
  where?: QueryEditorArrayExpression;
  groupBy?: QueryEditorArrayExpression;
  orderBy?: QueryEditorFunctionExpression;
  orderByDirection?: string;
  limit?: number;
}

export interface CloudWatchMetricsQuery extends MetricStat, DataQuery {
  queryMode?: 'Metrics';
  metricQueryType?: MetricQueryType;
  metricEditorMode?: MetricEditorMode;

  //common props
  id: string;

  alias?: string;
  label?: string;

  // Math expression query
  expression?: string;

  sqlExpression?: string;
  sql?: SQLExpression;
}

export interface MetricStat {
  region: string;
  namespace: string;
  metricName?: string;
  dimensions?: Dimensions;
  matchExact?: boolean;
  period?: string;
  statistic?: string;
  /**
   * @deprecated use statistic
   */
  statistics?: string[];
}

export interface CloudWatchMathExpressionQuery extends DataQuery {
  expression: string;
}

export type LogAction =
  | 'DescribeLogGroups'
  | 'GetQueryResults'
  | 'GetLogGroupFields'
  | 'GetLogEvents'
  | 'StartQuery'
  | 'StopQuery';

export enum CloudWatchLogsQueryStatus {
  Scheduled = 'Scheduled',
  Running = 'Running',
  Complete = 'Complete',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  Timeout = 'Timeout',
}

export interface CloudWatchLogsQuery extends DataQuery {
  queryMode: 'Logs';
  id: string;
  region: string;
  expression?: string;
  logGroupNames?: string[];
  statsGroups?: string[];
}

export type CloudWatchQuery = CloudWatchMetricsQuery | CloudWatchLogsQuery | CloudWatchAnnotationQuery;

export interface CloudWatchAnnotationQuery extends MetricStat, DataQuery {
  queryMode: 'Annotations';
  prefixMatching?: boolean;
  actionPrefix?: string;
  alarmNamePrefix?: string;
}

export type SelectableStrings = Array<SelectableValue<string>>;

export interface CloudWatchJsonData extends AwsAuthDataSourceJsonData {
  timeField?: string;
  database?: string;
  customMetricsNamespaces?: string;
  endpoint?: string;
  // Time string like 15s, 10m etc, see rangeUtils.intervalToMs.
  logsTimeout?: string;
  // Used to create links if logs contain traceId.
  tracingDatasourceUid?: string;
  defaultLogGroups?: string[];
}

export interface CloudWatchSecureJsonData extends AwsAuthDataSourceSecureJsonData {
  accessKey?: string;
  secretKey?: string;
}

export interface GetQueryResultsRequest {
  /**
   * The ID number of the query.
   */
  queryId: string;
}

export interface ResultField {
  /**
   * The log event field.
   */
  field?: string;
  /**
   * The value of this field.
   */
  value?: string;
}

export interface QueryStatistics {
  /**
   * The number of log events that matched the query string.
   */
  recordsMatched?: number;
  /**
   * The total number of log events scanned during the query.
   */
  recordsScanned?: number;
  /**
   * The total number of bytes in the log events scanned during the query.
   */
  bytesScanned?: number;
}

export type QueryStatus = 'Scheduled' | 'Running' | 'Complete' | 'Failed' | 'Cancelled' | string;

export type CloudWatchLogsRequest =
  | GetLogEventsRequest
  | StartQueryRequest
  | DescribeLogGroupsRequest
  | GetLogGroupFieldsRequest;

export interface GetLogEventsRequest {
  /**
   * The name of the log group.
   */
  logGroupName: string;
  /**
   * The name of the log stream.
   */
  logStreamName: string;
  /**
   * The start of the time range, expressed as the number of milliseconds after Jan 1, 1970 00:00:00 UTC. Events with a timestamp equal to this time or later than this time are included. Events with a timestamp earlier than this time are not included.
   */
  startTime?: number;
  /**
   * The end of the time range, expressed as the number of milliseconds after Jan 1, 1970 00:00:00 UTC. Events with a timestamp equal to or later than this time are not included.
   */
  endTime?: number;
  /**
   * The token for the next set of items to return. (You received this token from a previous call.) Using this token works only when you specify true for startFromHead.
   */
  nextToken?: string;
  /**
   * The maximum number of log events returned. If you don't specify a value, the maximum is as many log events as can fit in a response size of 1 MB, up to 10,000 log events.
   */
  limit?: number;
  /**
   * If the value is true, the earliest log events are returned first. If the value is false, the latest log events are returned first. The default value is false. If you are using nextToken in this operation, you must specify true for startFromHead.
   */
  startFromHead?: boolean;
  region?: string;
}

export interface GetQueryResultsResponse {
  /**
   * The log events that matched the query criteria during the most recent time it ran. The results value is an array of arrays. Each log event is one object in the top-level array. Each of these log event objects is an array of field/value pairs.
   */
  results?: ResultField[][];
  /**
   * Includes the number of log events scanned by the query, the number of log events that matched the query criteria, and the total number of bytes in the log events that were scanned.
   */
  statistics?: QueryStatistics;
  /**
   * The status of the most recent running of the query. Possible values are Cancelled, Complete, Failed, Running, Scheduled, Timeout, and Unknown. Queries time out after 15 minutes of execution. To avoid having your queries time out, reduce the time range being searched, or partition your query into a number of queries.
   */
  status?: QueryStatus;
}

export interface DescribeLogGroupsRequest {
  /**
   * The prefix to match.
   */
  logGroupNamePrefix?: string;
  /**
   * The token for the next set of items to return. (You received this token from a previous call.)
   */
  nextToken?: string;
  /**
   * The maximum number of items returned. If you don't specify a value, the default is up to 50 items.
   */
  limit?: number;
  refId?: string;
  region: string;
}

export interface TSDBResponse<T = any> {
  results: Record<string, TSDBQueryResult<T>>;
  message?: string;
}

export interface TSDBQueryResult<T = any> {
  refId: string;
  series: TSDBTimeSeries[];
  tables: Array<TSDBTable<T>>;

  error?: string;
  meta?: any;
}

export interface TSDBTable<T = any> {
  columns: Array<{ text: string }>;
  rows: T[];
}

export interface TSDBTimeSeries {
  name: string;
  points: TSDBTimePoint[];
  tags?: Record<string, string>;
}
export type TSDBTimePoint = [number, number];

export interface LogGroup {
  /**
   * The name of the log group.
   */
  logGroupName?: string;
  /**
   * The creation time of the log group, expressed as the number of milliseconds after Jan 1, 1970 00:00:00 UTC.
   */
  creationTime?: number;
  retentionInDays?: number;
  /**
   * The number of metric filters.
   */
  metricFilterCount?: number;
  /**
   * The Amazon Resource Name (ARN) of the log group.
   */
  arn?: string;
  /**
   * The number of bytes stored.
   */
  storedBytes?: number;
  /**
   * The Amazon Resource Name (ARN) of the CMK to use when encrypting log data.
   */
  kmsKeyId?: string;
}

export interface DescribeLogGroupsResponse {
  /**
   * The log groups.
   */
  logGroups?: LogGroup[];
  nextToken?: string;
}

export interface GetLogGroupFieldsRequest {
  /**
   * The name of the log group to search.
   */
  logGroupName: string;
  /**
   * The time to set as the center of the query. If you specify time, the 8 minutes before and 8 minutes after this time are searched. If you omit time, the past 15 minutes are queried. The time value is specified as epoch time, the number of seconds since January 1, 1970, 00:00:00 UTC.
   */
  time?: number;
  region: string;
}

export interface LogGroupField {
  /**
   * The name of a log field.
   */
  name?: string;
  /**
   * The percentage of log events queried that contained the field.
   */
  percent?: number;
}

export interface GetLogGroupFieldsResponse {
  /**
   * The array of fields found in the query. Each object in the array contains the name of the field, along with the percentage of time it appeared in the log events that were queried.
   */
  logGroupFields?: LogGroupField[];
}

export interface StartQueryRequest {
  /**
   * The log group on which to perform the query. A StartQuery operation must include a logGroupNames or a logGroupName parameter, but not both.
   */
  logGroupName?: string;
  /**
   * The list of log groups to be queried. You can include up to 20 log groups. A StartQuery operation must include a logGroupNames or a logGroupName parameter, but not both.
   */
  logGroupNames?: string[];
  /**
   * The query string to use. For more information, see CloudWatch Logs Insights Query Syntax.
   */
  queryString: string;
  /**
   * The maximum number of log events to return in the query. If the query string uses the fields command, only the specified fields and their values are returned. The default is 1000.
   */
  limit?: number;
  refId: string;
  region: string;
}
export interface StartQueryResponse {
  /**
   * The unique ID of the query.
   */
  queryId?: string;
}

export interface MetricRequest {
  from: string;
  to: string;
  queries: MetricQuery[];
  debug?: boolean;
}

export interface MetricQuery {
  [key: string]: any;
  datasource?: DataSourceRef;
  refId?: string;
  maxDataPoints?: number;
  intervalMs?: number;
}

export enum VariableQueryType {
  Regions = 'regions',
  Namespaces = 'namespaces',
  Metrics = 'metrics',
  DimensionKeys = 'dimensionKeys',
  DimensionValues = 'dimensionValues',
  EBSVolumeIDs = 'ebsVolumeIDs',
  EC2InstanceAttributes = 'ec2InstanceAttributes',
  ResourceArns = 'resourceARNs',
  Statistics = 'statistics',
  LogGroups = 'logGroups',
}

export interface OldVariableQuery extends DataQuery {
  queryType: VariableQueryType;
  namespace: string;
  region: string;
  metricName: string;
  dimensionKey: string;
  dimensionFilters: string;
  ec2Filters: string;
  instanceID: string;
  attributeName: string;
  resourceType: string;
  tags: string;
}

export interface VariableQuery extends DataQuery {
  queryType: VariableQueryType;
  namespace: string;
  region: string;
  metricName: string;
  dimensionKey: string;
  dimensionFilters?: Dimensions;
  ec2Filters?: MultiFilters;
  instanceID: string;
  attributeName: string;
  resourceType: string;
  tags?: MultiFilters;
  logGroupPrefix?: string;
}

export interface LegacyAnnotationQuery extends MetricStat, DataQuery {
  actionPrefix: string;
  alarmNamePrefix: string;
  alias: string;
  builtIn: number;
  datasource: any;
  dimensions: Dimensions;
  enable: boolean;
  expression: string;
  hide: boolean;
  iconColor: string;
  id: string;
  matchExact: boolean;
  metricName: string;
  name: string;
  namespace: string;
  period: string;
  prefixMatching: boolean;
  region: string;
  statistic: string;
  statistics: string[];
  target: {
    limit: number;
    matchAny: boolean;
    tags: any[];
    type: string;
  };
  type: string;
}

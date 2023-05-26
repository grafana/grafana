import { AwsAuthDataSourceJsonData, AwsAuthDataSourceSecureJsonData } from '@grafana/aws-sdk';
import { DataFrame, DataSourceRef } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import * as raw from './dataquery.gen';

export * from './dataquery.gen';

export type CloudWatchQuery =
  | raw.CloudWatchMetricsQuery
  | raw.CloudWatchLogsQuery
  | raw.CloudWatchAnnotationQuery
  | CloudWatchDefaultQuery;

// We want to allow setting defaults for both Logs and Metrics queries
export type CloudWatchDefaultQuery = Omit<raw.CloudWatchLogsQuery, 'queryMode'> & raw.CloudWatchMetricsQuery;

export interface MultiFilters {
  [key: string]: string[];
}

export type Direction = 'ASC' | 'DESC';

export type LogAction = 'GetQueryResults' | 'GetLogEvents' | 'StartQuery' | 'StopQuery';

export enum CloudWatchLogsQueryStatus {
  Scheduled = 'Scheduled',
  Running = 'Running',
  Complete = 'Complete',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  Timeout = 'Timeout',
}

export interface CloudWatchJsonData extends AwsAuthDataSourceJsonData {
  timeField?: string;
  database?: string;
  customMetricsNamespaces?: string;
  endpoint?: string;
  // Time string like 15s, 10m etc, see rangeUtils.intervalToMs.
  logsTimeout?: string;
  // Used to create links if logs contain traceId.
  tracingDatasourceUid?: string;

  logGroups?: raw.LogGroup[];
  /**
   * @deprecated use logGroups
   */
  defaultLogGroups?: string[];
}

export interface CloudWatchSecureJsonData extends AwsAuthDataSourceSecureJsonData {
  accessKey?: string;
  secretKey?: string;
}

export type CloudWatchLogsRequest = GetLogEventsRequest | StartQueryRequest | QueryParam;

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

export interface TSDBResponse<T = any> {
  results: Record<string, TSDBQueryResult<T>>;
  message?: string;
}

export interface TSDBQueryResult<T = any> {
  refId: string;
  series: TSDBTimeSeries[];
  tables: Array<TSDBTable<T>>;
  frames: DataFrame[];

  error?: string;
  meta?: any;
}

export interface TSDBTable<T = any> {
  columns: Array<{ text: string }>;
  rows: T[];
}

export interface DataQueryError<CloudWatchMetricsQuery> {
  data?: {
    message?: string;
    error?: string;
    results: Record<string, TSDBQueryResult<CloudWatchMetricsQuery>>;
  };
  message?: string;
}

export interface TSDBTimeSeries {
  name: string;
  points: TSDBTimePoint[];
  tags?: Record<string, string>;
}
export type TSDBTimePoint = [number, number];

export interface LogGroupField {
  /**
   * The name of a log field.
   */
  name: string;
  /**
   * The percentage of log events queried that contained the field.
   */
  percent?: number;
}

export interface StartQueryRequest {
  /**
   * The log group on which to perform the query. A StartQuery operation must include a logGroupNames or a logGroupName parameter, but not both.
   */
  logGroupName?: string;
  /**
   * The list of log groups to be queried. You can include up to 20 log groups. A StartQuery operation must include a logGroupNames or a logGroupName parameter, but not both.
   */
  logGroupNames?: string[] /* not quite deprecated yet, but will be soon */;
  logGroups?: raw.LogGroup[];
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

export interface QueryParam {
  queryId: string;
  refId: string;
  limit?: number;
  region: string;
  statsGroups?: string[];
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
  Accounts = 'accounts',
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
  dimensionFilters?: raw.Dimensions;
  ec2Filters?: MultiFilters;
  instanceID: string;
  attributeName: string;
  resourceType: string;
  tags?: MultiFilters;
  logGroupPrefix?: string;
  accountId?: string;
}

export interface LegacyAnnotationQuery extends raw.MetricStat, DataQuery {
  actionPrefix: string;
  alarmNamePrefix: string;
  alias: string;
  builtIn: number;
  datasource: any;
  dimensions: raw.Dimensions;
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

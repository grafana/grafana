import { DataQuery, DataSourceJsonData } from '@grafana/data';

export enum QueryType {
  ListDimensionKeys = 'ListDimensionKeys',
  ListDimensionValues = 'ListDimensionValues',
  ListMetrics = 'ListMetrics',
  ListParameters = 'ListParameters',
  ListDatasets = 'ListDatasets',
  GetMetricValue = 'GetMetricValue',
  GetMetricHistory = 'GetMetricHistory',
  GetMetricAggregate = 'GetMetricAggregate',
  GetMetricTable = 'GetMetricTable'
}

export enum OperatorType {
  Equals = '=',
  NotEquals = '!=',
  LessThan = '<',
  LessThanOrEqual = '<=',
  GreaterThan = '>',
  GreaterThanOrEqual = '>=',
  Like = 'LIKE',
  NotLike = 'NOT LIKE',
  In = 'IN',
  NotIn = 'NOT IN'
}

export enum AggregateType {
  Sum = 'SUM',
  Avg = 'AVG',
  RatioOfSums = 'RATIO_OF_SUMS',
  Count = "COUNT"
}

export enum OrderDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export interface Dataset {
  name: string;
  isFunction?: boolean;
}

export interface Metric {
  metricId: string;
}

export type Metrics = Metric[];

export interface Parameter {
  key: string;
  value?: string;
}

export type Parameters = Parameter[];

export interface Dimension {
  id: string;
  key?: string;
  value?: string | string[];
  operator?: OperatorType;
}

export type Dimensions = Dimension[];

export interface Aggregation {
  id: string;
  alias?: string;
  type: AggregateType;
  fields: string[];
}

export type Aggregations = Aggregation[];

export interface Order {
  id: string;
  field?: string;
  direction: OrderDirection;
}

export type Orders = Order[];

export interface DisplayName {
  id: string;
  field?: string;
  value?: string;
}

export type DisplayNames = DisplayName[];

export interface TypedQuery extends DataQuery {
  queryType?: QueryType;
}

export interface DatasetQuery extends TypedQuery {
  dataset?: string;
}

export interface GetQuery extends DatasetQuery {
  metrics?: Metrics;
  parameters?: Parameters;
  dimensions?: Dimensions;
  aggregations?: Aggregations;
  orders?: Orders;
  displayNames?: DisplayNames;
  maxItems?: string | number;
}

export interface NextQuery extends GetQuery {
  /**
   * The next token should never be saved in the JSON model, however some queries
   * will require multiple pages in order to fulfil the requests
   */
  nextToken?: string;
}

export interface Metadata {
  nextToken?: string;
}

export const defaultQuery: Partial<GetQuery> = {
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  endpoint?: string;
  apikey_authentication_enabled: boolean;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}

export interface GetMetricHistoryQuery extends GetQuery {
}

export interface GetMetricValueQuery extends GetQuery {
}

export interface GetMetricAggregateQuery extends GetQuery {
}

export interface GetMetricTableQuery extends GetQuery {
}

export interface ListDatasetsQuery extends TypedQuery {
}

export interface ListMetricsQuery extends DatasetQuery {
}

export interface ListDimensionKeysQuery extends DatasetQuery {
}

export interface ListDimensionValuesQuery extends DatasetQuery {
  dimensionKey?: string;
  dimensions?: Dimensions;
  filter?: string;
}

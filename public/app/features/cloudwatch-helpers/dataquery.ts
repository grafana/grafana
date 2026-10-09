import * as common from '@grafana/schema';

export interface MetricStat {
  /**
   * The ID of the AWS account to query for the metric, specifying `all` will query all accounts that the monitoring account is permitted to query.
   */
  accountId?: string;
  /**
   * The dimensions of the metric
   */
  dimensions?: Dimensions;
  /**
   * Only show metrics that exactly match all defined dimension names.
   */
  matchExact?: boolean;
  /**
   * Name of the metric
   */
  metricName?: string;
  /**
   * A namespace is a container for CloudWatch metrics. Metrics in different namespaces are isolated from each other, so that metrics from different applications are not mistakenly aggregated into the same statistics. For example, Amazon EC2 uses the AWS/EC2 namespace.
   */
  namespace: string;
  /**
   * The length of time associated with a specific Amazon CloudWatch statistic. Can be specified by a number of seconds, 'auto', or as a duration string e.g. '15m' being 15 minutes
   */
  period?: string;
  /**
   * AWS region to query for the metric
   */
  region: string;
  /**
   * Metric data aggregations over specified periods of time. For detailed definitions of the statistics supported by CloudWatch, see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Statistics-definitions.html.
   */
  statistic?: string;
  /**
   * @deprecated use statistic
   */
  statistics?: Array<string>;
}

/**
 * A name/value pair that is part of the identity of a metric. For example, you can get statistics for a specific EC2 instance by specifying the InstanceId dimension when you search for metrics.
 */
export type Dimensions = Record<string, (string | Array<string>)>;

/**
 * Shape of a CloudWatch Metrics query
 */
export interface CloudWatchMetricsQuery extends common.DataQuery, MetricStat {
  /**
   * Deprecated: use label
   * @deprecated use label
   */
  alias?: string;
  /**
   * Math expression query
   */
  expression?: string;
  /**
   * When the metric query type is set to `PromQL`, the response shape to return. Defaults to `time_series`.
   */
  format?: ('time_series' | 'table' | 'heatmap');
  /**
   * ID can be used to reference other queries in math expressions. The ID can include numbers, letters, and underscore, and must start with a lowercase letter.
   */
  id: string;
  /**
   * When the metric query type is set to `PromQL`, evaluates the expression at a single point in time. Default false.
   */
  instant?: boolean;
  /**
   * When the metric query type is set to `PromQL`, an additional lower bound for the step parameter of range queries and for the $__interval and $__rate_interval variables. Accepts duration strings like "10s", "1m". Empty means auto.
   */
  interval?: string;
  /**
   * Change the time series legend names using dynamic labels. See https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/graph-dynamic-labels.html for more details.
   */
  label?: string;
  /**
   * When the metric query type is set to `PromQL`, a template for series names. Supports `{{label}}` placeholders and the special value `__auto`.
   */
  legendFormat?: string;
  /**
   * Whether to use the query builder or code editor to create the query
   */
  metricEditorMode?: MetricEditorMode;
  /**
   * Whether to use a metric search or metric insights query
   */
  metricQueryType?: MetricQueryType;
  /**
   * When the metric query type is set to `PromQL`, this field is used to specify the PromQL expression.
   */
  promqlExpression?: string;
  /**
   * Whether a query is a Metrics, Logs, or Annotations query
   */
  queryMode?: CloudWatchQueryMode;
  /**
   * When the metric query type is set to `PromQL`, evaluates the expression across a time range. Default true.
   */
  range?: boolean;
  /**
   * When the metric query type is set to `Insights` and the `metricEditorMode` is set to `Builder`, this field is used to build up an object representation of a SQL query.
   */
  sql?: SQLExpression;
  /**
   * When the metric query type is set to `Insights`, this field is used to specify the query string.
   */
  sqlExpression?: string;
}

export type CloudWatchQueryMode = ('Metrics' | 'Logs' | 'Annotations');

export enum MetricQueryType {
  Insights = 1,
  PromQL = 2,
  Search = 0,
}

export enum MetricEditorMode {
  Builder = 0,
  Code = 1,
}

export interface SQLExpression {
  /**
   * FROM part of the SQL expression
   */
  from?: (QueryEditorPropertyExpression | QueryEditorFunctionExpression);
  /**
   * GROUP BY part of the SQL expression
   */
  groupBy?: QueryEditorArrayExpression;
  /**
   * LIMIT part of the SQL expression
   */
  limit?: number;
  /**
   * ORDER BY part of the SQL expression
   */
  orderBy?: QueryEditorFunctionExpression;
  /**
   * The sort order of the SQL expression, `ASC` or `DESC`
   */
  orderByDirection?: string;
  /**
   * SELECT part of the SQL expression
   */
  select?: QueryEditorFunctionExpression;
  /**
   * WHERE part of the SQL expression
   */
  where?: QueryEditorArrayExpression;
}

export interface QueryEditorFunctionExpression {
  name?: string;
  parameters?: Array<QueryEditorFunctionParameterExpression>;
  type: QueryEditorExpressionType.Function;
}

export const defaultQueryEditorFunctionExpression: Partial<QueryEditorFunctionExpression> = {
  parameters: [],
};

export enum QueryEditorExpressionType {
  And = 'and',
  Function = 'function',
  FunctionParameter = 'functionParameter',
  GroupBy = 'groupBy',
  Operator = 'operator',
  Or = 'or',
  Property = 'property',
}

export interface QueryEditorFunctionParameterExpression {
  name?: string;
  type: QueryEditorExpressionType.FunctionParameter;
}

export interface QueryEditorPropertyExpression {
  property: QueryEditorProperty;
  type: QueryEditorExpressionType.Property;
}

export interface QueryEditorGroupByExpression {
  property: QueryEditorProperty;
  type: QueryEditorExpressionType.GroupBy;
}

export interface QueryEditorOperatorExpression {
  /**
   * TS type is operator: QueryEditorOperator<QueryEditorOperatorValueType>, extended in veneer
   */
  operator: QueryEditorOperator;
  property: QueryEditorProperty;
  type: QueryEditorExpressionType.Operator;
}

/**
 * TS type is QueryEditorOperator<T extends QueryEditorOperatorValueType>, extended in veneer
 */
export interface QueryEditorOperator {
  name?: string;
  value?: (QueryEditorOperatorType | Array<QueryEditorOperatorType>);
}

export type QueryEditorOperatorValueType = (QueryEditorOperatorType | Array<QueryEditorOperatorType>);

export type QueryEditorOperatorType = (string | boolean | number);

export interface QueryEditorProperty {
  name?: string;
  type: QueryEditorPropertyType;
}

export enum QueryEditorPropertyType {
  String = 'string',
}

export interface QueryEditorArrayExpression {
  expressions: (Array<QueryEditorExpression> | Array<QueryEditorArrayExpression>);
  type: (QueryEditorExpressionType.And | QueryEditorExpressionType.Or);
}

export type QueryEditorExpression = (QueryEditorArrayExpression | QueryEditorPropertyExpression | QueryEditorGroupByExpression | QueryEditorFunctionExpression | QueryEditorFunctionParameterExpression | QueryEditorOperatorExpression);

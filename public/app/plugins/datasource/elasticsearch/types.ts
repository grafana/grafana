import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface ElasticsearchOptions extends DataSourceJsonData {
  timeField: string;
  esVersion: number;
  interval?: string;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
}

export type MetricAggregationType =
  | 'count'
  | 'avg'
  | 'sum'
  | 'min'
  | 'max'
  | 'extended_stats'
  | 'percentiles'
  | 'moving_avg'
  | 'cardinality'
  | 'derivative'
  | 'cumulative_sum'
  | 'bucket_script'
  | 'raw_document'
  | 'raw_data'
  | 'logs';

export type BucketAggregationType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram';

export interface MetricAggregation {
  id: number;
  type: MetricAggregationType;
  hide: boolean;
  field?: string;
  settings?: unknown;
}

// TODO: Fix the stuff below here.
interface MetricConfiguration {
  label: string;
  requiresField: boolean;
  supportsInlineScript?: boolean;
  supportsMissing?: boolean;
  isPipelineAgg?: boolean;
  minVersion?: number;
  supportsMultipleBucketPaths?: boolean;
  isSingleMetric?: boolean;
}
export type MetricsConfiguration = Record<MetricAggregationType, MetricConfiguration>;

export interface BucketAggregation {
  label: string;
  value: BucketAggregationType;
  [key: string]: any;
}

export interface ElasticsearchAggregation {
  id: number;
  type: MetricAggregationType | BucketAggregationType;
  settings?: any;
  field?: string;
  pipelineVariables?: Array<{ name?: string; pipelineAgg?: string }>;
  hide: boolean;
}

export interface ElasticsearchBucketAggregation extends ElasticsearchAggregation {
  type: BucketAggregationType;
}

export interface ElasticsearchQuery extends DataQuery {
  isLogsQuery?: boolean;
  alias?: string;
  query?: string;
  bucketAggs?: ElasticsearchBucketAggregation[];
  metrics?: MetricAggregation[];
  timeField?: string;
}

export interface NormalizedElasticsearchQuery extends ElasticsearchQuery {
  hide: NonNullable<ElasticsearchQuery['hide']>;
  isLogsQuery: NonNullable<ElasticsearchQuery['isLogsQuery']>;
  alias: NonNullable<ElasticsearchQuery['alias']>;
  query: NonNullable<ElasticsearchQuery['query']>;
  metrics: NonNullable<ElasticsearchQuery['metrics']>;
  bucketAggs: NonNullable<ElasticsearchQuery['bucketAggs']>;
  timeField: NonNullable<ElasticsearchQuery['timeField']>;
}

export const isNormalized = (
  query: ElasticsearchQuery | NormalizedElasticsearchQuery
): query is NormalizedElasticsearchQuery =>
  query.hide !== undefined &&
  query.isLogsQuery !== undefined &&
  query.alias !== undefined &&
  query.query !== undefined &&
  query.metrics !== undefined &&
  query.bucketAggs !== undefined;

export type DataLinkConfig = {
  field: string;
  url: string;
  datasourceUid?: string;
};

import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { MetricAggregation, MetricAggregationType } from './state/metricAggregation/types';

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

export type BucketAggregationType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram';

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

interface BucketConfiguration {
  label: string;
  requiresField: boolean;
}
export type MetricsConfiguration = Record<MetricAggregationType, MetricConfiguration>;
export type BucketsConfiguration = Record<BucketAggregationType, BucketConfiguration>;

export interface ElasticsearchAggregation {
  id: number;
  type: MetricAggregationType | BucketAggregationType;
  settings?: unknown;
  field?: string;
  hide: boolean;
}

export interface BucketAggregation extends ElasticsearchAggregation {
  type: BucketAggregationType;
}

export interface ElasticsearchQuery extends DataQuery {
  isLogsQuery?: boolean;
  alias?: string;
  query?: string;
  bucketAggs?: BucketAggregation[];
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

import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { BucketAggregation, BucketAggregationType } from './components/BucketAggregationsEditor/aggregations';
import { MetricAggregation, MetricAggregationType } from './components/MetricAggregationsEditor/aggregations';

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

interface MetricConfiguration {
  label: string;
  requiresField: boolean;
  supportsInlineScript: boolean;
  supportsMissing: boolean;
  isPipelineAgg: boolean;
  minVersion?: number;
  maxVersion?: number;
  supportsMultipleBucketPaths: boolean;
  // TODO: Maybe isSinglemetric is not necessary
  isSingleMetric?: boolean;
  hasSettings: boolean;
  hasMeta: boolean;
}

type BucketConfiguration<T extends BucketAggregationType> = {
  label: string;
  requiresField: boolean;
  defaultSettings: Extract<BucketAggregation, { type: T }>['settings'];
};

export type MetricsConfiguration = Record<MetricAggregationType, MetricConfiguration>;
export type BucketsConfiguration = {
  [P in BucketAggregationType]: BucketConfiguration<P>;
};

export interface ElasticsearchAggregation {
  id: string;
  type: MetricAggregationType | BucketAggregationType;
  settings?: unknown;
  field?: string;
  hide: boolean;
}

export interface ElasticsearchQuery extends DataQuery {
  isLogsQuery?: boolean;
  alias?: string;
  query?: string;
  bucketAggs?: BucketAggregation[];
  metrics?: MetricAggregation[];
  timeField?: string;
}

export type DataLinkConfig = {
  field: string;
  url: string;
  datasourceUid?: string;
};

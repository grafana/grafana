import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { MetricAggregation, MetricAggregationType } from './components/MetricAggregationsEditor/state/types';

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
  supportsInlineScript: boolean;
  supportsMissing: boolean;
  isPipelineAgg: boolean;
  minVersion?: number;
  maxVersion?: number;
  supportsMultipleBucketPaths?: boolean;
  isSingleMetric?: boolean;
  // TODO: this can probably be inferred from other settings
  hasSettings: boolean;
  hasMeta: boolean;
}

interface BucketConfiguration {
  label: string;
  requiresField: boolean;
}
export type MetricsConfiguration = Record<MetricAggregationType, MetricConfiguration>;
export type BucketsConfiguration = Record<BucketAggregationType, BucketConfiguration>;

export interface ElasticsearchAggregation {
  id: string;
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

export type DataLinkConfig = {
  field: string;
  url: string;
  datasourceUid?: string;
};

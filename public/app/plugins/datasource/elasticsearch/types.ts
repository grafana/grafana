import { DataQuery, DataSourceJsonData } from '@grafana/data';

import {
  BucketAggregation,
  BucketAggregationType,
} from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import {
  MetricAggregation,
  MetricAggregationType,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';

export type Interval = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface ElasticsearchOptions extends DataSourceJsonData {
  timeField: string;
  esVersion: string;
  xpack?: boolean;
  interval?: Interval;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
  includeFrozen?: boolean;
}

interface MetricConfiguration<T extends MetricAggregationType> {
  label: string;
  requiresField: boolean;
  supportsInlineScript: boolean;
  supportsMissing: boolean;
  isPipelineAgg: boolean;
  xpack?: boolean;
  /**
   * A valid semver range for which the metric is known to be available.
   * If omitted defaults to '*'.
   */
  versionRange?: string;
  supportsMultipleBucketPaths: boolean;
  isSingleMetric?: boolean;
  hasSettings: boolean;
  hasMeta: boolean;
  defaults: Omit<Extract<MetricAggregation, { type: T }>, 'id' | 'type'>;
}

type BucketConfiguration<T extends BucketAggregationType> = {
  label: string;
  requiresField: boolean;
  defaultSettings: Extract<BucketAggregation, { type: T }>['settings'];
};

export type MetricsConfiguration = {
  [P in MetricAggregationType]: MetricConfiguration<P>;
};

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
  alias?: string;
  query?: string;
  bucketAggs?: BucketAggregation[];
  metrics?: MetricAggregation[];
  timeField?: string;
}

export interface TermsQuery {
  query?: string;
  size?: number;
  field?: string;
  order?: 'asc' | 'desc';
  orderBy?: string;
}

export type DataLinkConfig = {
  field: string;
  url: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
};

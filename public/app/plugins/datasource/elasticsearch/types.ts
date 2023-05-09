import { DataSourceJsonData } from '@grafana/data';

import {
  BucketAggregationType,
  MetricAggregation,
  MetricAggregationType,
  MovingAverageEWMAModelSettings,
  MovingAverageHoltModelSettings,
  MovingAverageHoltWintersModelSettings,
  MovingAverageLinearModelSettings,
  MovingAverageModel,
  MovingAverageSimpleModelSettings,
  ExtendedStats,
  MovingAverage as SchemaMovingAverage,
  BucketAggregation,
  Logs as SchemaLogs,
} from './dataquery.gen';

export * from './dataquery.gen';
export { Elasticsearch as ElasticsearchQuery } from './dataquery.gen';

// We want to extend the settings of the Logs query with additional properties that
// are not part of the schema. This is a workaround, because exporting LogsSettings
// from dataquery.gen.ts and extending that produces error in SettingKeyOf.
type ExtendedLogsSettings = SchemaLogs['settings'] & {
  searchAfter?: unknown[];
  sortDirection?: 'asc' | 'desc';
};

export interface Logs extends SchemaLogs {
  settings?: ExtendedLogsSettings;
}

export type MetricAggregationWithMeta = ExtendedStats;

export type MovingAverageModelSettings<T extends MovingAverageModel = MovingAverageModel> = Partial<
  Extract<
    | MovingAverageSimpleModelSettings
    | MovingAverageLinearModelSettings
    | MovingAverageEWMAModelSettings
    | MovingAverageHoltModelSettings
    | MovingAverageHoltWintersModelSettings,
    { model: T }
  >
>;

export interface MovingAverage<T extends MovingAverageModel = MovingAverageModel> extends SchemaMovingAverage {
  settings?: MovingAverageModelSettings<T>;
}

export type Interval = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface ElasticsearchOptions extends DataSourceJsonData {
  timeField: string;
  // we used to have a field named `esVersion` in the past,
  // please do not use that name in the future.
  xpack?: boolean;
  interval?: Interval;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
  includeFrozen?: boolean;
  index?: string;
}

interface MetricConfiguration<T extends MetricAggregationType> {
  label: string;
  requiresField: boolean;
  supportsInlineScript: boolean;
  supportsMissing: boolean;
  isPipelineAgg: boolean;
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

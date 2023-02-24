import { DataSourceJsonData } from '@grafana/data';

import {
  BucketAggregationType,
  Filter,
  MetricAggregation,
  MetricAggregationType,
  MovingAverageEWMAModelSettings,
  MovingAverageHoltModelSettings,
  MovingAverageHoltWintersModelSettings,
  MovingAverageLinearModelSettings,
  MovingAverageModel,
  MovingAverageSimpleModelSettings,
  PipelineMetricAggregationType,
  TermsOrder,
  ExtendedStats,
  BasePipelineMetricAggregation as SchemaBasePipelineMetricAggregation,
  PipelineMetricAggregationWithMultipleBucketPaths as SchemaPipelineMetricAggregationWithMultipleBucketPaths,
  MovingAverage as SchemaMovingAverage,
  Filters as SchemaFilters,
  Terms as SchemaTerms,
  DateHistogram as SchemaDateHistogram,
  Histogram as SchemaHistogram,
  GeoHashGrid as SchemaGeoHashGrid,
  Nested as SchemaNested,
} from './dataquery.gen';

export * from './dataquery.gen';
export { Elasticsearch as ElasticsearchQuery } from './dataquery.gen';

export type MetricAggregationWithMeta = ExtendedStats;

// Start of temporary overrides because of incorrect type generation in dataquery.gen.ts
// TODO: Remove this once the type generation is fixed
export interface BasePipelineMetricAggregation extends SchemaBasePipelineMetricAggregation {
  type: PipelineMetricAggregationType;
}

export interface PipelineMetricAggregationWithMultipleBucketPaths
  extends SchemaPipelineMetricAggregationWithMultipleBucketPaths {
  type: PipelineMetricAggregationType;
}

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

export interface Filters extends SchemaFilters {
  settings?: {
    filters?: Filter[];
  };
}

export interface Terms extends SchemaTerms {
  settings?: {
    min_doc_count?: string;
    missing?: string;
    order?: TermsOrder;
    orderBy?: string;
    size?: string;
  };
}

export interface DateHistogram extends SchemaDateHistogram {
  settings?: {
    interval?: string;
    min_doc_count?: string;
    offset?: string;
    timeZone?: string;
    trimEdges?: string;
  };
}

export interface Histogram extends SchemaHistogram {
  settings?: {
    interval?: string;
    min_doc_count?: string;
  };
}

interface GeoHashGrid extends SchemaGeoHashGrid {
  settings?: {
    precision?: string;
  };
}

interface Nested extends SchemaNested {
  settings?: {};
}

export type BucketAggregation = DateHistogram | Histogram | Terms | Filters | GeoHashGrid | Nested;
// End of temporary overrides

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

import { DataSourceJsonData } from '@grafana/data';

import * as Schema from './dataquery.gen';

// Commented out types have temporary overrides as types are not resolved correctly in multi-level type extensions
export interface ElasticsearchQuery extends Schema.Elasticsearch {}
// export type BucketAggregation = Schema.BucketAggregation;
export type MetricAggregation = Schema.MetricAggregation;
export type BucketAggregationType = Schema.BucketAggregationType;
export interface BaseBucketAggregation extends Schema.BaseBucketAggregation {}
export interface BucketAggregationWithField extends Schema.BucketAggregationWithField {}
// export interface DateHistogram extends Schema.DateHistogram {}
export interface DateHistogramSettings extends Schema.DateHistogramSettings {}
// export interface Histogram extends Schema.Histogram {}
export interface HistogramSettings extends Schema.HistogramSettings {}
export type TermsOrder = Schema.TermsOrder;
// export interface Terms extends Schema.Terms {}
export interface TermsSettings extends Schema.TermsSettings {}
//export interface Nested extends Schema.Nested {}
// export interface Filters extends Schema.Filters {}
export type Filter = Schema.Filter;
export interface FiltersSettings extends Schema.FiltersSettings {}
// export interface GeoHashGrid extends Schema.GeoHashGrid {}
export interface GeoHashGridSettings extends Schema.GeoHashGridSettings {}
export type PipelineMetricAggregationType = Schema.PipelineMetricAggregationType;
export type MetricAggregationType = Schema.MetricAggregationType;
export interface BaseMetricAggregation extends Schema.BaseMetricAggregation {}
export interface PipelineVariable extends Schema.PipelineVariable {}
export interface MetricAggregationWithField extends Schema.MetricAggregationWithField {}
export interface MetricAggregationWithMissingSupport extends Schema.MetricAggregationWithMissingSupport {}
export type InlineScript = Schema.InlineScript;
export interface MetricAggregationWithInlineScript extends Schema.MetricAggregationWithInlineScript {}
export interface Count extends Schema.Count {}
export interface Average extends Schema.Average {}
export interface Sum extends Schema.Sum {}
export interface Max extends Schema.Max {}
export interface Min extends Schema.Min {}
export type ExtendedStatMetaType = Schema.ExtendedStatMetaType;
export interface ExtendedStat extends Schema.ExtendedStat {}
export interface ExtendedStats extends Schema.ExtendedStats {}
export type MetricAggregationWithMeta = Schema.ExtendedStats;
export interface Percentiles extends Schema.Percentiles {}
export interface UniqueCount extends Schema.UniqueCount {}
export interface RawDocument extends Schema.RawDocument {}
export interface RawData extends Schema.RawData {}
export interface Logs extends Schema.Logs {}
export interface Rate extends Schema.Rate {}
// export interface BasePipelineMetricAggregation extends Schema.BasePipelineMetricAggregation{}
// export interface PipelineMetricAggregationWithMultipleBucketPaths extends Schema.PipelineMetricAggregationWithMultipleBucketPaths{}
// export type MovingAverageModelSettings = Schema.MovingAverageModelSettings
// export interface MovingAverage extends Schema.MovingAverage{}
export type MovingAverageModel = Schema.MovingAverageModel;
export interface MovingAverageModelOption extends Schema.MovingAverageModelOption {}
export interface BaseMovingAverageModelSettings extends Schema.BaseMovingAverageModelSettings {}
export interface MovingAverageSimpleModelSettings extends Schema.MovingAverageSimpleModelSettings {}
export interface MovingAverageLinearModelSettings extends Schema.MovingAverageLinearModelSettings {}
export interface MovingAverageEWMAModelSettings extends Schema.MovingAverageEWMAModelSettings {}
export interface MovingAverageHoltModelSettings extends Schema.MovingAverageHoltModelSettings {}
export interface MovingAverageHoltWintersModelSettings extends Schema.MovingAverageHoltWintersModelSettings {}
export interface MovingFunction extends Schema.MovingFunction {}
export interface Derivative extends Schema.Derivative {}
export interface SerialDiff extends Schema.SerialDiff {}
export interface CumulativeSum extends Schema.CumulativeSum {}
export interface BucketScript extends Schema.BucketScript {}
export interface TopMetrics extends Schema.TopMetrics {}
export type PipelineMetricAggregation = Schema.PipelineMetricAggregation;
export type MetricAggregationWithSettings = Schema.MetricAggregationWithSettings;
export interface ElasticsearchQuery extends Schema.Elasticsearch {}

// Start of temporary overrides because of incorrect type generation in dataquery.gen.ts
export interface BasePipelineMetricAggregation extends Schema.BasePipelineMetricAggregation {
  type: PipelineMetricAggregationType;
}

export interface PipelineMetricAggregationWithMultipleBucketPaths
  extends Schema.PipelineMetricAggregationWithMultipleBucketPaths {
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

export interface MovingAverage<T extends MovingAverageModel = MovingAverageModel> extends Schema.MovingAverage {
  settings?: MovingAverageModelSettings<T>;
}

export interface Filters extends Schema.Filters {
  settings?: {
    filters?: Filter[];
  };
}

export interface Terms extends Schema.Terms {
  settings?: {
    min_doc_count?: string;
    missing?: string;
    order?: Schema.TermsOrder;
    orderBy?: string;
    size?: string;
  };
}

export interface DateHistogram extends Schema.DateHistogram {
  settings?: {
    interval?: string;
    min_doc_count?: string;
    offset?: string;
    timeZone?: string;
    trimEdges?: string;
  };
}

export interface Histogram extends Schema.Histogram {
  settings?: {
    interval?: string;
    min_doc_count?: string;
  };
}

export interface Terms extends Schema.Terms {
  settings?: {
    order?: TermsOrder;
    size?: string;
    min_doc_count?: string;
    orderBy?: string;
    missing?: string;
  };
}
export interface Filters extends Schema.Filters {
  settings?: {
    filters?: Schema.Filter[];
  };
}

interface GeoHashGrid extends Schema.GeoHashGrid {
  settings?: {
    precision?: string;
  };
}

interface Nested extends Schema.Nested {
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

interface MetricConfiguration<T extends Schema.MetricAggregationType> {
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
  defaults: Omit<Extract<Schema.MetricAggregation, { type: T }>, 'id' | 'type'>;
}

type BucketConfiguration<T extends Schema.BucketAggregationType> = {
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

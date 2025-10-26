import { DataSourceJsonData } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';

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
  ElasticsearchDataQuery,
} from './dataquery.gen';

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
  interval?: Interval;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
  includeFrozen?: boolean;
  index?: string;
  sigV4Auth?: boolean;
  oauthPassThru?: boolean;
}

export type QueryType = 'metrics' | 'logs' | 'raw_data' | 'raw_document';

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
  impliedQueryType: QueryType;
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

export interface ElasticsearchAnnotationQuery {
  target: ElasticsearchDataQuery;
  timeField?: string;
  titleField?: string;
  timeEndField?: string;
  query?: string;
  datasource: DataSourceRef;
  tagsField?: string;
  textField?: string;
  // @deprecated index is deprecated and will be removed in the future
  index?: string;
}

export type RangeMap = Record<string, { from: number; to: number; format: string }>;

export type ElasticsearchResponse = ElasticsearchResponseWithHits | ElasticsearchResponseWithAggregations;

export type ElasticsearchResponseWithHits = {
  responses: Array<{
    hits: {
      hits: ElasticsearchHits;
    };
  }>;
};
export type ElasticsearchHits = Array<Record<string, string | number | Record<string | number, string | number>>>;

export type ElasticsearchResponseWithAggregations = {
  responses: Array<{
    aggregations: {
      [key: string]: {
        buckets: Array<{
          key_as_string?: string;
          key: string;
          doc_count: number;
          [key: string]: string | number | undefined;
        }>;
      };
    };
  }>;
};

export const isElasticsearchResponseWithHits = (res: unknown): res is ElasticsearchResponseWithHits => {
  return (
    res &&
    typeof res === 'object' &&
    'responses' in res &&
    Array.isArray(res['responses']) &&
    res['responses'].find((response: unknown) => {
      return (
        typeof response === 'object' &&
        response !== null &&
        'hits' in response &&
        typeof response['hits'] === 'object' &&
        response['hits'] !== null &&
        'hits' in response['hits'] &&
        Array.isArray(response['hits']['hits'])
      );
    })
  );
};

export const isElasticsearchResponseWithAggregations = (res: unknown): res is ElasticsearchResponseWithAggregations => {
  return (
    res &&
    typeof res === 'object' &&
    'responses' in res &&
    Array.isArray(res['responses']) &&
    res['responses'].find((response: unknown) => {
      return (
        typeof response === 'object' &&
        response !== null &&
        'aggregations' in response &&
        typeof response['aggregations'] === 'object' &&
        response['aggregations'] !== null &&
        Object.keys(response['aggregations']).length > 0
      );
    })
  );
};

import { bucketAggregationConfig } from './utils';

export type SimpleBucketAggregationType = 'nested';
export type BucketAggregationWithSettingsType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram';
export type BucketAggregationType = SimpleBucketAggregationType | BucketAggregationWithSettingsType;

interface BaseBucketAggregation {
  id: string;
  type: BucketAggregationType;
}

export interface BucketAggregationWithField extends BaseBucketAggregation {
  field?: string;
}

export interface BaseBucketAggregationWithSettings extends BaseBucketAggregation {
  settings?: Record<string, unknown>;
}

export interface DateHistogram extends BucketAggregationWithField, BaseBucketAggregationWithSettings {
  type: 'date_histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
    trimEdges?: string;
    offset?: string;
    timeZone?: string;
  };
}

export interface Histogram extends BucketAggregationWithField, BaseBucketAggregationWithSettings {
  type: 'histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
  };
}

type TermsOrder = 'desc' | 'asc';

export interface Terms extends BucketAggregationWithField, BaseBucketAggregationWithSettings {
  type: 'terms';
  settings?: {
    order?: TermsOrder;
    size?: string;
    min_doc_count?: string;
    orderBy?: string;
    missing?: string;
  };
}

export type Filter = {
  query: string;
  label: string;
};
export interface Filters extends BaseBucketAggregation, BaseBucketAggregationWithSettings {
  type: 'filters';
  settings?: {
    filters?: Filter[];
  };
}

interface GeoHashGrid extends BucketAggregationWithField, BaseBucketAggregationWithSettings {
  type: 'geohash_grid';
  settings?: {
    precision?: string;
  };
}

interface Nested extends BucketAggregationWithField {
  type: 'nested';
}

export type BucketAggregation = DateHistogram | Histogram | Terms | Filters | GeoHashGrid | Nested;

export const isBucketAggregationWithField = (
  bucketAgg: BucketAggregation | BucketAggregationWithField
): bucketAgg is BucketAggregationWithField => bucketAggregationConfig[bucketAgg.type].requiresField;

export type BucketAggregationWithSettings = DateHistogram | Histogram | Terms | Filters | GeoHashGrid;

export const isBucketAggregationWithSettings = (
  bucketAgg: BucketAggregation | BucketAggregationWithSettings
): bucketAgg is BucketAggregationWithSettings => bucketAggregationConfig[bucketAgg.type].hasSettings;

export const BUCKET_AGGREGATION_TYPES: Array<BucketAggregationType | BucketAggregationWithSettingsType> = [
  'date_histogram',
  'histogram',
  'terms',
  'filters',
  'geohash_grid',
  'nested',
];

export const isBucketAggregationType = (s: BucketAggregationType | string): s is BucketAggregationType =>
  BUCKET_AGGREGATION_TYPES.includes(s as BucketAggregationType);

import { bucketAggregationConfig } from './utils';

export type BucketAggregationType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram' | 'nested';

interface BaseBucketAggregation {
  id: string;
  type: BucketAggregationType;
  settings?: Record<string, unknown>;
}

export interface BucketAggregationWithField extends BaseBucketAggregation {
  field?: string;
}

export interface DateHistogram extends BucketAggregationWithField {
  type: 'date_histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
    trimEdges?: string;
    offset?: string;
    timeZone?: string;
  };
}

export interface Histogram extends BucketAggregationWithField {
  type: 'histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
  };
}

type TermsOrder = 'desc' | 'asc';

export interface Terms extends BucketAggregationWithField {
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
export interface Filters extends BaseBucketAggregation {
  type: 'filters';
  settings?: {
    filters?: Filter[];
  };
}

interface GeoHashGrid extends BucketAggregationWithField {
  type: 'geohash_grid';
  settings?: {
    precision?: string;
  };
}

interface Nested extends BucketAggregationWithField {
  type: 'nested';
  settings?: {};
}

export type BucketAggregation = DateHistogram | Histogram | Terms | Filters | GeoHashGrid | Nested;

export const isBucketAggregationWithField = (
  bucketAgg: BucketAggregation | BucketAggregationWithField
): bucketAgg is BucketAggregationWithField => bucketAggregationConfig[bucketAgg.type].requiresField;

export const BUCKET_AGGREGATION_TYPES: BucketAggregationType[] = [
  'date_histogram',
  'histogram',
  'terms',
  'filters',
  'geohash_grid',
  'nested',
];

export const isBucketAggregationType = (s: BucketAggregationType | string): s is BucketAggregationType =>
  BUCKET_AGGREGATION_TYPES.includes(s as BucketAggregationType);

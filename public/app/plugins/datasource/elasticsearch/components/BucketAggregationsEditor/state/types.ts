import { Action } from '../../../hooks/useReducerCallback';
import { bucketAggregationConfig } from '../../../query_def';
import { SettingKeyOf } from '../../types';

export const ADD_BUCKET_AGG = '@bucketAggs/add';
export const REMOVE_BUCKET_AGG = '@bucketAggs/remove';
export const CHANGE_BUCKET_AGG_TYPE = '@bucketAggs/change_type';
export const CHANGE_BUCKET_AGG_FIELD = '@bucketAggs/change_field';
export const CHANGE_BUCKET_AGG_SETTING = '@bucketAggs/change_setting';

export type BucketAggregationType = 'terms' | 'filters' | 'geohash_grid' | 'date_histogram' | 'histogram';

interface BaseBucketAggregation {
  id: string;
  type: BucketAggregationType;
  settings?: Record<string, unknown>;
}

export interface BucketAggregationWithField extends BaseBucketAggregation {
  field?: string;
}

export const isBucketAggregationWithField = (
  bucketAgg: BucketAggregation | BucketAggregationWithField
): bucketAgg is BucketAggregationWithField => bucketAggregationConfig[bucketAgg.type].requiresField;

interface DateHistogram extends BucketAggregationWithField {
  type: 'date_histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
    trimEdges?: string;
    offset?: string;
  };
}

interface Histogram extends BucketAggregationWithField {
  type: 'histogram';
  settings?: {
    interval?: string;
    min_doc_count?: string;
  };
}

type TermsOrder = 'desc' | 'asc';

interface Terms extends BucketAggregationWithField {
  type: 'terms';
  settings?: {
    order?: TermsOrder;
    size?: number;
    min_doc_count?: string;
    orderBy?: string;
    missing?: string;
  };
}

interface Filters extends BaseBucketAggregation {
  type: 'filters';
  settings?: {
    filters?: Array<{ query?: string; label?: string }>;
  };
}

interface GeoHashGrid extends BucketAggregationWithField {
  type: 'geohash_grid';
  settings?: {
    precision?: number;
  };
}

export type BucketAggregation = DateHistogram | Histogram | Terms | Filters | GeoHashGrid;

//
// Action Types
export interface AddBucketAggregationAction extends Action<typeof ADD_BUCKET_AGG> {
  payload: {
    aggregationType: BucketAggregation['type'];
  };
}

export interface RemoveBucketAggregationAction extends Action<typeof REMOVE_BUCKET_AGG> {
  payload: {
    id: BucketAggregation['id'];
  };
}

export interface ChangeBucketAggregationTypeAction extends Action<typeof CHANGE_BUCKET_AGG_TYPE> {
  payload: {
    id: BucketAggregation['id'];
    newType: BucketAggregation['type'];
  };
}

export interface ChangeBucketAggregationFieldAction extends Action<typeof CHANGE_BUCKET_AGG_FIELD> {
  payload: {
    id: BucketAggregation['id'];
    newField: BucketAggregationWithField['field'];
  };
}

export interface ChangeBucketAggregationSettingAction<T extends BucketAggregation>
  extends Action<typeof CHANGE_BUCKET_AGG_SETTING> {
  payload: {
    bucketAgg: T;
    settingName: SettingKeyOf<T>;
    newValue: unknown;
  };
}

export type BucketAggregationAction<T extends BucketAggregation = BucketAggregation> =
  | AddBucketAggregationAction
  | RemoveBucketAggregationAction
  | ChangeBucketAggregationTypeAction
  | ChangeBucketAggregationFieldAction
  | ChangeBucketAggregationSettingAction<T>;

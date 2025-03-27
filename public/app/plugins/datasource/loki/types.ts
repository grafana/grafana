import { DataQuery, DataQueryRequest, DataSourceJsonData, TimeRange } from '@grafana/data';

import {
  LokiDataQuery as LokiQueryFromSchema,
  LokiQueryType,
  SupportingQueryType,
  LokiQueryDirection,
} from './dataquery.gen';

export { LokiQueryDirection, LokiQueryType, SupportingQueryType };

export enum LokiResultType {
  Stream = 'streams',
  Vector = 'vector',
  Matrix = 'matrix',
}

export enum LabelType {
  Indexed = 'I',
  StructuredMetadata = 'S',
  Parsed = 'P',
}

export interface LokiQuery extends LokiQueryFromSchema {
  direction?: LokiQueryDirection;
  /** Used only to identify supporting queries, e.g. logs volume, logs sample and data sample */
  supportingQueryType?: SupportingQueryType;
  // CUE autogenerates `queryType` as `?string`, as that's how it is defined
  // in the parent-interface (in DataQuery).
  // the temporary fix (until this gets improved in the codegen), is to
  // override it here
  queryType?: LokiQueryType;

  /**
   * This is a property for the experimental query splitting feature.
   * @experimental
   */
  splitDuration?: string;
}

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
  alertmanager?: string;
  keepCookies?: string[];
  predefinedOperations?: string;
}

export interface LokiStreamResult {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

export interface LokiTailResponse {
  streams: LokiStreamResult[];
  dropped_entries?: Array<{
    labels: Record<string, string>;
    timestamp: string;
  }> | null;
}

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
  matcherType?: 'label' | 'regex';
  targetBlank?: boolean;
};

export enum LokiVariableQueryType {
  LabelNames,
  LabelValues,
}

export interface LokiVariableQuery extends DataQuery {
  type: LokiVariableQueryType;
  label?: string;
  stream?: string;
}

export interface QueryStats {
  streams: number;
  chunks: number;
  bytes: number;
  entries: number;
  // The error message displayed in the UI when we cant estimate the size of the query.
  message?: string;
}

export interface ContextFilter {
  enabled: boolean;
  label: string;
  value: string;
  nonIndexed: boolean;
}

export interface ParserAndLabelKeysResult {
  extractedLabelKeys: string[];
  structuredMetadataKeys: string[];
  hasJSON: boolean;
  hasLogfmt: boolean;
  hasPack: boolean;
  unwrapLabelKeys: string[];
}

export interface DetectedFieldsResult {
  fields: Array<{
    label: string;
    type: 'bytes' | 'float' | 'int' | 'string' | 'duration';
    cardinality: number;
    parsers: Array<'logfmt' | 'json'> | null;
  }>;
  limit: number;
}

export type LokiGroupedRequest = { request: DataQueryRequest<LokiQuery>; partition: TimeRange[] };

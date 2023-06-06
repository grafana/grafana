import { DataQuery, DataQueryRequest, DataSourceJsonData, QueryResultMeta, ScopedVars, TimeRange } from '@grafana/data';

import { Loki as LokiQueryFromSchema, LokiQueryType, SupportingQueryType, LokiQueryDirection } from './dataquery.gen';

export { LokiQueryDirection, LokiQueryType, SupportingQueryType };

export interface LokiInstantQueryRequest {
  query: string;
  limit?: number;
  time?: string;
  direction?: LokiQueryDirection;
}

export interface LokiRangeQueryRequest {
  query: string;
  limit?: number;
  start?: number;
  end?: number;
  step?: number;
  direction?: LokiQueryDirection;
}

export enum LokiResultType {
  Stream = 'streams',
  Vector = 'vector',
  Matrix = 'matrix',
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

export interface LokiStats {
  [component: string]: {
    [label: string]: number;
  };
}

export interface LokiVectorResult {
  metric: { [label: string]: string };
  value: [number, string];
}

export interface LokiVectorResponse {
  status: string;
  data: {
    resultType: LokiResultType.Vector;
    result: LokiVectorResult[];
    stats?: LokiStats;
  };
}

export interface LokiMatrixResult {
  metric: Record<string, string>;
  values: Array<[number, string]>;
}

export interface LokiMatrixResponse {
  status: string;
  data: {
    resultType: LokiResultType.Matrix;
    result: LokiMatrixResult[];
    stats?: LokiStats;
  };
}

export interface LokiStreamResult {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

export interface LokiStreamResponse {
  status: string;
  data: {
    resultType: LokiResultType.Stream;
    result: LokiStreamResult[];
    stats?: LokiStats;
  };
}

export interface LokiTailResponse {
  streams: LokiStreamResult[];
  dropped_entries?: Array<{
    labels: Record<string, string>;
    timestamp: string;
  }> | null;
}

export type LokiResult = LokiVectorResult | LokiMatrixResult | LokiStreamResult;
export type LokiResponse = LokiVectorResponse | LokiMatrixResponse | LokiStreamResponse;

export interface LokiLogsStreamEntry {
  line: string;
  ts: string;
}

export interface LokiExpression {
  regexp: string;
  query: string;
}

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
};

export interface TransformerOptions {
  legendFormat?: string;
  query: string;
  refId: string;
  scopedVars: ScopedVars;
  meta?: QueryResultMeta;
}

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
}

export interface ContextFilter {
  enabled: boolean;
  label: string;
  value: string;
  fromParser: boolean;
  description?: string;
}

export type LokiGroupedRequest = { request: DataQueryRequest<LokiQuery>; partition: TimeRange[] };

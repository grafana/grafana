import { DataQuery, DataSourceJsonData, QueryResultMeta } from '@grafana/data';

export interface LokiInstantQueryRequest {
  query: string;
  limit?: number;
  time?: string;
  direction?: 'BACKWARD' | 'FORWARD';
}

export interface LokiRangeQueryRequest {
  query: string;
  limit?: number;
  start?: number;
  end?: number;
  step?: number;
  direction?: 'BACKWARD' | 'FORWARD';
}

export enum LokiResultType {
  Stream = 'streams',
  Vector = 'vector',
  Matrix = 'matrix',
}

export interface LokiQuery extends DataQuery {
  expr: string;
  liveStreaming?: boolean;
  query?: string;
  format?: string;
  reverse?: boolean;
  legendFormat?: string;
  valueWithRefId?: boolean;
  maxLines?: number;
}

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
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
  metric: { [label: string]: string };
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
  }>;
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
  datasourceUid?: string;
};

export interface TransformerOptions {
  format: string;
  legendFormat: string;
  step: number;
  start: number;
  end: number;
  query: string;
  responseListLength: number;
  refId: string;
  meta?: QueryResultMeta;
  valueWithRefId?: boolean;
}

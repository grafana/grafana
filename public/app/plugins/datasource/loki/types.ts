import { Labels, DataQuery, DataSourceJsonData } from '@grafana/data';

export interface LokiLegacyQueryRequest {
  query: string;
  limit?: number;
  start?: number;
  end?: number;
  direction?: 'BACKWARD' | 'FORWARD';
  regexp?: string;

  refId: string;
}

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
  regexp?: string;
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

export interface LokiVectorResult {
  metric: { [label: string]: string };
  value: [number, string];
}

export interface LokiVectorResponse {
  status: string;
  data: {
    resultType: LokiResultType.Vector;
    result: LokiVectorResult[];
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
  };
}

export interface LokiLegacyStreamResult {
  labels: string;
  entries: LokiLogsStreamEntry[];
  search?: string;
  parsedLabels?: Labels;
  uniqueLabels?: Labels;
}

export interface LokiLegacyStreamResponse {
  streams: LokiLegacyStreamResult[];
}

export interface LokiTailResponse {
  streams: LokiStreamResult[];
  dropped_entries?: Array<{
    labels: Record<string, string>;
    timestamp: string;
  }>;
}

export type LokiResult = LokiVectorResult | LokiMatrixResult | LokiStreamResult | LokiLegacyStreamResult;
export type LokiResponse = LokiVectorResponse | LokiMatrixResponse | LokiStreamResponse;

export interface LokiLogsStreamEntry {
  line: string;
  ts: string;
  // Legacy, was renamed to ts
  timestamp?: string;
}

export interface LokiExpression {
  regexp: string;
  query: string;
}

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  datasourceName?: string;
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
  valueWithRefId?: boolean;
}

import { Labels, DataQuery, DataSourceJsonData } from '@grafana/data';

export interface LokiLegacyQueryRequest {
  query: string;
  limit?: number;
  start?: number | string;
  end?: number | string;
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

export interface LokiQueryRangeRequest {
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
  legendFormat?: string;
  valueWithRefId?: boolean;
}

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
}

export interface LokiLegacyResponse {
  streams: LokiStreamResult[];
}

export interface LokiVectorResult {
  metric: { [label: string]: string };
  value: [number, string];
}

export interface LokiMatrixResult {
  metric: { [label: string]: string };
  values: Array<[number, string]>;
}

export type LokiResult = LokiMatrixResult | LokiVectorResult | LokiStreamResult;

export interface LokiVectorResponse {
  resultType: LokiResultType.Vector;
  result: LokiVectorResult[];
}

export interface LokiMatrixResponse {
  resultType: LokiResultType.Matrix;
  result: LokiMatrixResult[];
}

export interface LokiStreamResponse {
  resultType: LokiResultType.Stream;
  result: LokiStreamResult[];
}

export type LokiResponse = LokiVectorResponse | LokiMatrixResponse | LokiStreamResponse;

export interface LokiStreamResult {
  labels: string;
  entries: LokiLogsStreamEntry[];
  search?: string;
  parsedLabels?: Labels;
  uniqueLabels?: Labels;
}

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

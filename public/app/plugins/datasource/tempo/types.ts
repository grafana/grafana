import { DataSourceJsonData, KeyValue } from '@grafana/data/src';

import { TempoQuery } from './datasource';

export interface MyDataSourceOptions extends DataSourceJsonData {}

export const defaultQuery: Partial<TempoQuery> = {};

export type TraceSearchMetadata = {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano: string;
  durationMs: number;
  spanSets?: Spanset[];
};

export type SearchMetrics = {
  inspectedTraces?: number;
  inspectedBytes?: number;
  inspectedBlocks?: number;
  skippedBlocks?: number;
  skippedTraces?: number;
  totalBlockBytes?: number;
  spanSets?: Spanset[];
};

export enum SpanKind {
  UNSPECIFIED,
  INTERNAL,
  SERVER,
  CLIENT,
  PRODUCER,
  CONSUMER,
}

export type Span = {
  traceId: string;
  spanId: string;
  traceState?: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  attributes?: KeyValue[];
  dropped_attributes_count?: number;
};

export type Spanset = {
  attributes: KeyValue[];
  spans: Span[];
};

export type SearchResponse = {
  traces: TraceSearchMetadata[];
  metrics: SearchMetrics;
};

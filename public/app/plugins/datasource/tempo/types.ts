import { DataSourceJsonData } from '@grafana/data/src';

import { TempoQuery } from './datasource';

export interface MyDataSourceOptions extends DataSourceJsonData {}

export const defaultQuery: Partial<TempoQuery> = {};

export type TraceSearchMetadata = {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano: string;
  durationMs: number;
};

export type SearchMetrics = {
  inspectedTraces?: number;
  inspectedBytes?: number;
  inspectedBlocks?: number;
  skippedBlocks?: number;
  skippedTraces?: number;
  totalBlockBytes?: number;
};

export type SearchResponse = {
  traces: TraceSearchMetadata[];
  metrics: SearchMetrics;
};

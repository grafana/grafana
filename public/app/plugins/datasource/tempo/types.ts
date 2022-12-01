import { DataQuery } from '@grafana/data';
import { DataSourceJsonData, KeyValue } from '@grafana/data/src';
import { NodeGraphOptions } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogs/TraceToLogsSettings';

import { LokiQuery } from '../loki/types';

export interface SearchQueryParams {
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
  tags?: string;
  start?: number;
  end?: number;
}

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
  };
  nodeGraph?: NodeGraphOptions;
  lokiSearch?: {
    datasourceUid?: string;
  };
  spanBar?: {
    tag: string;
  };
  traceQuery?: {
    timeShiftEnabled?: boolean;
    spanStartTimeShift?: string;
    spanEndTimeShift?: string;
  };
}

// search = Loki search, nativeSearch = Tempo search for backwards compatibility
export type TempoQueryType = 'traceql' | 'search' | 'traceId' | 'serviceMap' | 'upload' | 'nativeSearch' | 'clear';

export interface TempoQuery extends DataQuery {
  query: string;
  // Query to find list of traces, e.g., via Loki
  linkedQuery?: LokiQuery;
  search?: string;
  queryType: TempoQueryType;
  serviceName?: string;
  spanName?: string;
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
  serviceMapQuery?: string;
}

export interface MyDataSourceOptions extends DataSourceJsonData {}

export const defaultQuery: Partial<TempoQuery> = {};

export type TraceSearchMetadata = {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano?: string;
  durationMs?: number;
  spanSet?: { spans: Span[] };
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
  durationNanos: string;
  traceId?: string;
  spanID: string;
  traceState?: string;
  parentSpanId?: string;
  name?: string;
  kind?: SpanKind;
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  attributes?: Array<{
    key: string;
    value: { stringValue?: string; intValue?: string; boolValue?: boolean; doubleValue?: string };
  }>;
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

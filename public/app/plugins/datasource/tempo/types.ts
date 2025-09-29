import { DataSourceJsonData } from '@grafana/data';
import { NodeGraphOptions, TraceToLogsOptions } from '@grafana/o11y-ds-frontend';

import { TempoQuery as TempoBase, TempoQueryType, TraceqlFilter } from './dataquery.gen';

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
    filters?: TraceqlFilter[];
  };
  nodeGraph?: NodeGraphOptions;
  spanBar?: {
    tag: string;
  };
  tagLimit?: number;
  traceQuery?: {
    timeShiftEnabled?: boolean;
    spanStartTimeShift?: string;
    spanEndTimeShift?: string;
  };
  streamingEnabled?: {
    search?: boolean;
  };
  timeRangeForTags?: number;
}

export interface TempoQuery extends TempoBase {
  queryType: TempoQueryType;
  serviceMapUseNativeHistograms?: boolean;
}

export interface MyDataSourceOptions extends DataSourceJsonData {}

export const defaultQuery: Partial<TempoQuery> = {};

export type TraceSearchMetadata = {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano?: string;
  durationMs?: number;
  spanSet?: Spanset; // deprecated in Tempo, https://github.com/grafana/tempo/blob/3cc44fca03ba7d676dc77da6a18b8222546ede3c/docs/sources/tempo/api_docs/_index.md?plain=1#L619
  spanSets?: Spanset[];
};

export type SearchMetrics = {
  inspectedTraces?: number;
  inspectedBytes?: number;
  totalBlocks?: number;
  completedJobs?: number;
  totalJobs?: number;
  totalBlockBytes?: number;
};

export enum SpanKind {
  UNSPECIFIED,
  INTERNAL,
  SERVER,
  CLIENT,
  PRODUCER,
  CONSUMER,
}

export type SpanAttributes = {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    boolValue?: boolean;
    doubleValue?: string;
    Value?: {
      string_value?: string;
      int_value?: string;
      bool_value?: boolean;
      double_value?: string;
    };
  };
};

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
  attributes?: SpanAttributes[];
  dropped_attributes_count?: number;
};

export type Spanset = {
  attributes?: SpanAttributes[];
  spans: Span[];
};

export type SearchResponse = {
  traces: TraceSearchMetadata[];
  metrics: SearchMetrics;
};

export type Scope = {
  name: string;
  tags: string[];
};

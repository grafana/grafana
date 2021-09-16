import { DataQuery } from '@grafana/data';

export type TraceKeyValuePair = {
  key: string;
  type?: string;
  value: any;
};

export type TraceLink = {
  url: string;
  text: string;
};

export type TraceLog = {
  timestamp: number;
  fields: TraceKeyValuePair[];
};

export type TraceProcess = {
  serviceName: string;
  tags: TraceKeyValuePair[];
};

export type TraceSpanReference = {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM';
  spanID: string;
  traceID: string;
};

export type Span = {
  spanID: string;
  traceID: string;
  processID: string;
  operationName: string;
  // Times are in microseconds
  startTime: number;
  duration: number;
  logs: TraceLog[];
  tags?: TraceKeyValuePair[];
  references?: TraceSpanReference[];
  warnings?: string[] | null;
  stackTraces?: string[];
  flags: number;
};

export type TraceResponse = {
  processes: Record<string, TraceProcess>;
  traceID: string;
  warnings?: string[] | null;
  spans: Span[];
};

export type JaegerQuery = {
  // undefined means the old behavior, showing only trace ID input
  queryType?: JaegerQueryType;
  service?: string;
  operation?: string;
  // trace ID
  query?: string;
  tags?: string;
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
} & DataQuery;

export type JaegerQueryType = 'search' | 'upload';

export type JaegerResponse = {
  data: TraceResponse[];
  total: number;
  limit: number;
  offset: number;
  errors?: string[] | null;
};

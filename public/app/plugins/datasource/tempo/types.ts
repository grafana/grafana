export type AnyValue = { stringValue?: string } | { boolValue?: boolean } | { intValue?: string };

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export interface Event {
  timeUnixNano: string;
  attributes: KeyValue[];
}

export interface Link {
  traceId: string;
  spanId: string;
  traceState?: string;
  attributes?: KeyValue[];
}

export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

export interface SpanStatus {
  code?: SpanStatusCode | string;
  message?: string;
}

export interface Span {
  traceId: string;
  spanId: string;
  traceState?: string;
  parentSpanId?: string;
  name: string;
  kind?: 'CLIENT' | 'SERVER' | 'PRODUCER' | 'CONSUMER';
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: KeyValue[];
  events?: Event[];
  links?: Link[];
  status?: SpanStatus;
}

export interface TempoResponse {
  batches: ResourceSpans[];
}

export interface Resource {
  attributes: KeyValue[];
}

export interface ResourceSpans {
  resource: Resource;
  instrumentationLibrarySpans: Array<{ spans: Span[] }>;
}

export function isTempoResponse(response: any): response is TempoResponse {
  return 'batches' in response;
}

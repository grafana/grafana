// Copied from https://github.com/grafana/grafana-jaeger-datasource — the Jaeger datasource was removed
// from core and moved to an external repo, but the core trace download utility still needs to support
// converting DataFrames to Jaeger format for existing traces tagged with traceFormat: 'jaeger'.
import { type MutableDataFrame, type TraceKeyValuePair, type TraceLog } from '@grafana/data';

type TraceProcess = {
  serviceName: string;
  tags: TraceKeyValuePair[];
};

type TraceSpanReference = {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM';
  spanID: string;
  traceID: string;
};

type Span = {
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

type TraceResponse = {
  processes: Record<string, TraceProcess>;
  traceID: string;
  warnings?: string[] | null;
  spans: Span[];
};

type JaegerResponse = {
  data: TraceResponse[];
  total: number;
  limit: number;
  offset: number;
  errors?: string[] | null;
};

export function transformToJaeger(data: MutableDataFrame): JaegerResponse {
  let traceResponse: TraceResponse = {
    traceID: '',
    spans: [],
    processes: {},
    warnings: null,
  };
  let processes: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const span = data.get(i);

    // Set traceID
    if (!traceResponse.traceID) {
      traceResponse.traceID = span.traceID;
    }

    // Create process if doesn't exist
    if (!processes.find((p) => p === span.serviceName)) {
      processes.push(span.serviceName);
      traceResponse.processes[`p${processes.length}`] = {
        serviceName: span.serviceName,
        tags: span.serviceTags,
      };
    }

    // Create span
    traceResponse.spans.push({
      traceID: span.traceID,
      spanID: span.spanID,
      duration: span.duration * 1000,
      references: span.parentSpanID
        ? [
            {
              refType: 'CHILD_OF',
              spanID: span.parentSpanID,
              traceID: span.traceID,
            },
          ]
        : [],
      flags: 0,
      logs: span.logs.map((l: TraceLog) => ({
        ...l,
        timestamp: l.timestamp * 1000,
      })),
      operationName: span.operationName,
      processID:
        Object.keys(traceResponse.processes).find(
          (key) => traceResponse.processes[key].serviceName === span.serviceName
        ) || '',
      startTime: span.startTime * 1000,
      tags: span.tags,
      warnings: span.warnings ? span.warnings : null,
    });
  }

  return { data: [traceResponse], total: 0, limit: 0, offset: 0, errors: null };
}

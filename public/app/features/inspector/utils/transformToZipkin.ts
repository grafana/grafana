// Copied from https://github.com/grafana/grafana-zipkin-datasource — the Zipkin datasource was removed
// from core and moved to an external repo, but the core trace download utility still needs to support
// converting DataFrames to Zipkin format for existing traces tagged with traceFormat: 'zipkin'.
import { type MutableDataFrame, type TraceKeyValuePair, type TraceLog, type TraceSpanRow } from '@grafana/data';

export type ZipkinAnnotation = {
  timestamp: number;
  value: string;
};

export type ZipkinSpan = {
  traceId: string;
  parentId?: string;
  name: string;
  id: string;
  timestamp: number;
  duration: number;
  localEndpoint?: ZipkinEndpoint;
  remoteEndpoint?: ZipkinEndpoint;
  annotations?: ZipkinAnnotation[];
  tags?: { [key: string]: string };
  kind?: 'CLIENT' | 'SERVER' | 'PRODUCER' | 'CONSUMER';
  shared?: boolean;
};

export type ZipkinEndpoint = {
  serviceName: string;
  ipv4?: string;
  ipv6?: string;
  port?: number;
};

/**
 * Transforms data frame to Zipkin response
 */
export const transformToZipkin = (data: MutableDataFrame<TraceSpanRow>): ZipkinSpan[] => {
  let response: ZipkinSpan[] = [];

  for (let i = 0; i < data.length; i++) {
    const span = data.get(i);
    response.push({
      traceId: span.traceID,
      parentId: span.parentSpanID,
      name: span.operationName,
      id: span.spanID,
      timestamp: span.startTime * 1000,
      duration: span.duration * 1000,
      ...getEndpoint(span),
      annotations: span.logs?.length
        ? span.logs.map((l: TraceLog) => ({ timestamp: l.timestamp, value: l.fields[0].value }))
        : undefined,
      tags: span.tags?.length
        ? span.tags
            .filter((t: TraceKeyValuePair) => t.key !== 'kind' && t.key !== 'endpointType' && t.key !== 'shared')
            .reduce((tags: { [key: string]: string }, t: TraceKeyValuePair) => {
              if (t.key === 'error') {
                return {
                  ...tags,
                  [t.key]: span.tags?.find((t: TraceKeyValuePair) => t.key === 'errorValue')?.value || '',
                };
              }
              return { ...tags, [t.key]: t.value };
            }, {})
        : undefined,
      kind: span.tags?.find((t: TraceKeyValuePair) => t.key === 'kind')?.value,
      shared: span.tags?.find((t: TraceKeyValuePair) => t.key === 'shared')?.value,
    });
  }

  return response;
};

// Returns remote or local endpoint object
const getEndpoint = (span: TraceSpanRow): { [key: string]: ZipkinEndpoint } | undefined => {
  const key =
    span.serviceTags.find((t: TraceKeyValuePair) => t.key === 'endpointType')?.value === 'local'
      ? 'localEndpoint'
      : 'remoteEndpoint';
  return span.serviceName !== 'unknown'
    ? {
        [key]: {
          serviceName: span.serviceName,
          ipv4: span.serviceTags.find((t: TraceKeyValuePair) => t.key === 'ipv4')?.value,
          ipv6: span.serviceTags.find((t: TraceKeyValuePair) => t.key === 'ipv6')?.value,
          port: span.serviceTags.find((t: TraceKeyValuePair) => t.key === 'port')?.value,
        },
      }
    : undefined;
};

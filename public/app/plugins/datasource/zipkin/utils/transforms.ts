import { DataFrame, FieldType, MutableDataFrame, TraceKeyValuePair, TraceLog, TraceSpanRow } from '@grafana/data';

import { ZipkinAnnotation, ZipkinEndpoint, ZipkinSpan } from '../types';

/**
 * Transforms response to Grafana trace data frame.
 */
export function transformResponse(zSpans: ZipkinSpan[]): DataFrame {
  const spanRows = zSpans.map(transformSpan);
  const frame = new MutableDataFrame({
    fields: [
      { name: 'traceID', type: FieldType.string, values: [] },
      { name: 'spanID', type: FieldType.string, values: [] },
      { name: 'parentSpanID', type: FieldType.string, values: [] },
      { name: 'operationName', type: FieldType.string, values: [] },
      { name: 'serviceName', type: FieldType.string, values: [] },
      { name: 'serviceTags', type: FieldType.other, values: [] },
      { name: 'startTime', type: FieldType.number, values: [] },
      { name: 'duration', type: FieldType.number, values: [] },
      { name: 'logs', type: FieldType.other, values: [] },
      { name: 'tags', type: FieldType.other, values: [] },
    ],
    meta: {
      preferredVisualisationType: 'trace',
      custom: {
        traceFormat: 'zipkin',
      },
    },
  });

  for (const span of spanRows) {
    frame.add(span);
  }

  return frame;
}

function transformSpan(span: ZipkinSpan): TraceSpanRow {
  const row = {
    traceID: span.traceId,
    spanID: span.id,
    parentSpanID: span.parentId,
    operationName: span.name,
    serviceName: span.localEndpoint?.serviceName || span.remoteEndpoint?.serviceName || 'unknown',
    serviceTags: serviceTags(span),
    startTime: span.timestamp / 1000,
    duration: span.duration / 1000,
    logs: span.annotations?.map(transformAnnotation) ?? [],
    tags: Object.keys(span.tags || {}).reduce<TraceKeyValuePair[]>((acc, key) => {
      // If tag is error we remap it to simple boolean so that the trace ui will show an error icon.
      if (key === 'error') {
        acc.push({
          key: 'error',
          value: true,
        });

        acc.push({
          key: 'errorValue',
          value: span.tags!['error'],
        });
        return acc;
      }
      acc.push({ key, value: span.tags![key] });
      return acc;
    }, []),
  };

  if (span.kind) {
    row.tags = [
      {
        key: 'kind',
        value: span.kind,
      },
      ...(row.tags ?? []),
    ];
  }

  if (span.shared) {
    row.tags = [
      {
        key: 'shared',
        value: span.shared,
      },
      ...(row.tags ?? []),
    ];
  }

  return row;
}

/**
 * Maps annotations as a log as that seems to be the closest thing.
 * See https://zipkin.io/zipkin-api/#/default/get_trace__traceId_
 */
function transformAnnotation(annotation: ZipkinAnnotation): TraceLog {
  return {
    timestamp: annotation.timestamp,
    fields: [
      {
        key: 'annotation',
        value: annotation.value,
      },
    ],
  };
}

function serviceTags(span: ZipkinSpan): TraceKeyValuePair[] {
  const endpoint = span.localEndpoint || span.remoteEndpoint;
  if (!endpoint) {
    return [];
  }
  return [
    valueToTag('ipv4', endpoint.ipv4),
    valueToTag('ipv6', endpoint.ipv6),
    valueToTag('port', endpoint.port),
    valueToTag('endpointType', span.localEndpoint ? 'local' : 'remote'),
  ].filter((item): item is TraceKeyValuePair => Boolean(item));
}

function valueToTag<T>(key: string, value: T): TraceKeyValuePair<T> | undefined {
  if (!value) {
    return undefined;
  }
  return {
    key,
    value,
  };
}

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

import { identity } from 'lodash';
import { ZipkinAnnotation, ZipkinSpan } from '../types';
import { DataFrame, FieldType, MutableDataFrame, TraceKeyValuePair, TraceLog, TraceSpanRow } from '@grafana/data';

/**
 * Transforms response to Grafana trace data frame.
 */
export function transformResponse(zSpans: ZipkinSpan[]): DataFrame {
  const spanRows = zSpans.map(transformSpan);
  const frame = new MutableDataFrame({
    fields: [
      { name: 'traceID', type: FieldType.string },
      { name: 'spanID', type: FieldType.string },
      { name: 'parentSpanID', type: FieldType.string },
      { name: 'operationName', type: FieldType.string },
      { name: 'serviceName', type: FieldType.string },
      { name: 'serviceTags', type: FieldType.other },
      { name: 'startTime', type: FieldType.number },
      { name: 'duration', type: FieldType.number },
      { name: 'logs', type: FieldType.other },
      { name: 'tags', type: FieldType.other },
    ],
    meta: {
      preferredVisualisationType: 'trace',
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
  ].filter(identity) as TraceKeyValuePair[];
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

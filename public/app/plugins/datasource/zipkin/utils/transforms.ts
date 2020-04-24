import { identity } from 'lodash';
import { keyBy } from 'lodash';
import { ZipkinAnnotation, ZipkinSpan } from '../types';
import { Log, Process, SpanData, TraceData } from '@jaegertracing/jaeger-ui-components';

/**
 * Transforms response to format similar to Jaegers as we use Jaeger ui on the frontend.
 */
export function transformResponse(zSpans: ZipkinSpan[]): TraceData & { spans: SpanData[] } {
  return {
    processes: gatherProcesses(zSpans),
    traceID: zSpans[0].traceId,
    spans: zSpans.map(transformSpan),
    warnings: null,
  };
}

function transformSpan(span: ZipkinSpan): SpanData {
  const jaegerSpan: SpanData = {
    duration: span.duration,
    // TODO: not sure what this is
    flags: 1,
    logs: span.annotations?.map(transformAnnotation) ?? [],
    operationName: span.name,
    processID: span.localEndpoint.serviceName,
    startTime: span.timestamp,
    spanID: span.id,
    traceID: span.traceId,
    warnings: null as any,
    tags: Object.keys(span.tags || {}).map(key => {
      // If tag is error we remap it to simple boolean so that the Jaeger ui will show an error icon.
      return {
        key,
        type: key === 'error' ? 'bool' : 'string',
        value: key === 'error' ? true : span.tags[key],
      };
    }),
    references: span.parentId
      ? [
          {
            refType: 'CHILD_OF',
            spanID: span.parentId,
            traceID: span.traceId,
          },
        ]
      : [],
  };
  if (span.kind) {
    jaegerSpan.tags = [
      {
        key: 'kind',
        type: 'string',
        value: span.kind,
      },
      ...jaegerSpan.tags,
    ];
  }

  return jaegerSpan;
}

/**
 * Maps annotations as a Jaeger log as that seems to be the closest thing.
 * See https://zipkin.io/zipkin-api/#/default/get_trace__traceId_
 */
function transformAnnotation(annotation: ZipkinAnnotation): Log {
  return {
    timestamp: annotation.timestamp,
    fields: [
      {
        key: 'annotation',
        type: 'string',
        value: annotation.value,
      },
    ],
  };
}

function gatherProcesses(zSpans: ZipkinSpan[]): Record<string, Process> {
  const processes = zSpans.map(span => ({
    serviceName: span.localEndpoint.serviceName,
    tags: [
      {
        key: 'ipv4',
        type: 'string',
        value: span.localEndpoint.ipv4,
      },
      span.localEndpoint.port
        ? {
            key: 'port',
            type: 'number',
            value: span.localEndpoint.port,
          }
        : undefined,
    ].filter(identity),
  }));
  return keyBy(processes, 'serviceName');
}

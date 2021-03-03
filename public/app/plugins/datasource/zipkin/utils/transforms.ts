import { identity, keyBy } from 'lodash';
import { ZipkinAnnotation, ZipkinEndpoint, ZipkinSpan } from '../types';
import * as Jaeger from '../../jaeger/types';

/**
 * Transforms response to format similar to Jaegers as we use Jaeger ui on the frontend.
 */
export function transformResponse(zSpans: ZipkinSpan[]): Jaeger.TraceResponse {
  return {
    processes: gatherProcesses(zSpans),
    traceID: zSpans[0].traceId,
    spans: zSpans.map(transformSpan),
    warnings: null,
  };
}

function transformSpan(span: ZipkinSpan): Jaeger.Span {
  const jaegerSpan: Jaeger.Span = {
    duration: span.duration,
    // TODO: not sure what this is
    flags: 1,
    logs: span.annotations?.map(transformAnnotation) ?? [],
    operationName: span.name,
    processID: span.localEndpoint?.serviceName || span.remoteEndpoint?.serviceName || 'unknown',
    startTime: span.timestamp,
    spanID: span.id,
    traceID: span.traceId,
    warnings: null as any,
    tags: Object.keys(span.tags || {}).map((key) => {
      // If tag is error we remap it to simple boolean so that the Jaeger ui will show an error icon.
      return {
        key,
        type: key === 'error' ? 'bool' : 'string',
        value: key === 'error' ? true : span.tags![key],
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
      ...(jaegerSpan.tags ?? []),
    ];
  }

  return jaegerSpan;
}

/**
 * Maps annotations as a Jaeger log as that seems to be the closest thing.
 * See https://zipkin.io/zipkin-api/#/default/get_trace__traceId_
 */
function transformAnnotation(annotation: ZipkinAnnotation): Jaeger.TraceLog {
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

function gatherProcesses(zSpans: ZipkinSpan[]): Record<string, Jaeger.TraceProcess> {
  const processes = zSpans.reduce((acc, span) => {
    if (span.localEndpoint) {
      acc.push(endpointToProcess(span.localEndpoint));
    }
    if (span.remoteEndpoint) {
      acc.push(endpointToProcess(span.remoteEndpoint));
    }
    return acc;
  }, [] as Jaeger.TraceProcess[]);
  return keyBy(processes, 'serviceName');
}

function endpointToProcess(endpoint: ZipkinEndpoint): Jaeger.TraceProcess {
  return {
    serviceName: endpoint.serviceName,
    tags: [
      valueToTag('ipv4', endpoint.ipv4, 'string'),
      valueToTag('ipv6', endpoint.ipv6, 'string'),
      valueToTag('port', endpoint.port, 'number'),
    ].filter(identity) as Jaeger.TraceKeyValuePair[],
  };
}

function valueToTag(
  key: string,
  value: string | number | undefined,
  type: string
): Jaeger.TraceKeyValuePair | undefined {
  if (!value) {
    return undefined;
  }
  return {
    key,
    type,
    value,
  };
}

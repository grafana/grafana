import { TraceData, TraceKeyValuePair, TraceLog, TraceProcess, TraceSpanData, TraceSpanReference } from '@grafana/data';
import { keyBy } from 'lodash';
import { AnyValue, KeyValue, Link, Span, SpanStatusCode, TempoResponse } from './types';

/**
 * Transforms response to format to Jaegers.
 */
export function transformResponse(response: TempoResponse, traceId: string): TraceData & { spans: TraceSpanData[] } {
  const spans = [];
  const processes: TraceProcess[] = [];
  for (const resourceSpans of response.batches) {
    processes.push(getProcess(resourceSpans.resource.attributes));
    for (const iLSpans of resourceSpans.instrumentationLibrarySpans) {
      for (const span of iLSpans.spans) {
        spans.push(getSpan(span, traceId, getServiceName(resourceSpans.resource.attributes)));
      }
    }
  }

  return {
    processes: keyBy(processes, 'serviceName'),
    traceID: traceId,
    spans,
    warnings: null,
  };
}

function getSpan(otSpan: Span, traceID: string, processID: string): TraceSpanData {
  const startTime = parseInt(otSpan.startTimeUnixNano, 10) / 1000;
  const endTime = parseInt(otSpan.endTimeUnixNano, 10) / 1000;
  const tags: TraceKeyValuePair[] = [];
  const logs: TraceLog[] = [];
  const references: TraceSpanReference[] = [];

  if (otSpan.events) {
    for (const event of otSpan.events) {
      logs.push({
        timestamp: parseInt(event.timeUnixNano, 10) / 1000,
        fields: transformKeyValuesToKeyValuePairs(event.attributes),
      });
    }
  }

  if (otSpan.kind) {
    tags.push({ key: 'span.kind', type: 'string', value: otSpan.kind.toLowerCase() });
  }

  if (otSpan.status) {
    // When status code is string it most probably contains an error code
    if (typeof otSpan.status.code === 'string') {
      tags.push({ key: 'status.code', type: 'int64', value: SpanStatusCode.ERROR });
      tags.push({ key: 'error', type: 'bool', value: true });
    } else {
      tags.push({ key: 'status.code', type: 'int64', value: otSpan.status.code ?? SpanStatusCode.UNSET });
    }
  }

  if (otSpan.attributes) {
    tags.push(...transformKeyValuesToKeyValuePairs(otSpan.attributes));
  }

  if (otSpan.parentSpanId) {
    references.push({
      refType: 'CHILD_OF',
      spanID: btoa(otSpan.parentSpanId),
      traceID,
    });
  }

  if (otSpan.links) {
    references.push(...spanLinksToJaegerRefs(otSpan.links, traceID, otSpan.parentSpanId));
  }

  return {
    traceID,
    spanID: btoa(otSpan.spanId),
    processID,
    operationName: otSpan.name,
    flags: 1,
    logs,
    startTime: startTime,
    references,
    duration: endTime - startTime,
    tags,
  };
}

function spanLinksToJaegerRefs(links: Link[], traceID: string, parentSpanId?: string): TraceSpanReference[] {
  return links
    .map((link): TraceSpanReference | null => {
      if (link.spanId === parentSpanId) {
        return { spanID: btoa(link.spanId), traceID, refType: 'FOLLOWS_FROM' };
      }
      return null;
    })
    .filter((ref) => !!ref) as TraceSpanReference[];
}

function transformKeyValuesToKeyValuePairs(attributes: KeyValue[]): TraceKeyValuePair[] {
  return attributes.map((attribute) => ({
    key: attribute.key,
    value: getAttributeValue(attribute.value),
    type: getAttributeType(attribute.value),
  }));
}

function getProcess(attributes: KeyValue[]): TraceProcess {
  return {
    serviceName: getServiceName(attributes),
    tags: transformKeyValuesToKeyValuePairs(attributes),
  };
}

function getServiceName(attributes: KeyValue[]): string {
  const serviceName = attributes.find((a) => a.key === 'service.name');

  if (serviceName) {
    return getAttributeValue(serviceName.value) as string;
  }

  return '';
}

function getAttributeValue(value: AnyValue) {
  if ('stringValue' in value) {
    return value.stringValue ?? '';
  }

  if ('boolValue' in value) {
    return Boolean(value.boolValue);
  }

  if ('intValue' in value) {
    return value.intValue ? parseInt(value.intValue, 10) : 0;
  }

  return '';
}

function getAttributeType(value: AnyValue) {
  if ('stringValue' in value) {
    return 'string';
  }

  if ('boolValue' in value) {
    return 'bool';
  }

  if ('intValue' in value) {
    return 'int64';
  }

  return 'string';
}

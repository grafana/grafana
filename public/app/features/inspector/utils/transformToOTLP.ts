// Copied from https://github.com/grafana/grafana-tempo-datasource — the Tempo datasource was removed
// from core and moved to an external repo, but the core trace download utility still needs to support
// converting DataFrames to OTLP format for existing traces tagged with traceFormat: 'otlp'.
import { type SpanStatus } from '@opentelemetry/api';
import { collectorTypes } from '@opentelemetry/exporter-collector';

import {
  type MutableDataFrame,
  type TraceKeyValuePair,
  type TraceLog,
  type TraceSpanReference,
  type TraceSpanRow,
} from '@grafana/data';

export function transformToOTLP(data: MutableDataFrame): {
  batches: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[];
} {
  let result: { batches: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[] } = {
    batches: [],
  };

  // Lookup object to see which batch contains spans for which services
  let services: { [key: string]: number } = {};

  for (let i = 0; i < data.length; i++) {
    const span = data.get(i);

    // Group spans based on service
    if (services[span.serviceName] === undefined) {
      services[span.serviceName] = result.batches.length;
      result.batches.push({
        resource: {
          attributes: [],
          droppedAttributesCount: 0,
        },
        instrumentationLibrarySpans: [
          {
            spans: [],
          },
        ],
      });
    }

    let batchIndex = services[span.serviceName];

    // Populate resource attributes from service tags
    if (result.batches[batchIndex].resource!.attributes.length === 0) {
      result.batches[batchIndex].resource!.attributes = tagsToAttributes(span.serviceTags);
    }

    // Populate instrumentation library if it exists
    if (!result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary) {
      if (span.instrumentationLibraryName) {
        result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary = {
          name: span.instrumentationLibraryName,
          version: span.instrumentationLibraryVersion ? span.instrumentationLibraryVersion : '',
        };
      }
    }

    result.batches[batchIndex].instrumentationLibrarySpans[0].spans.push({
      traceId: span.traceID.padStart(32, '0'),
      spanId: span.spanID,
      parentSpanId: span.parentSpanID || '',
      traceState: span.traceState || '',
      name: span.operationName,
      kind: getOTLPSpanKind(span.kind),
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: (span.startTime + span.duration) * 1000000,
      attributes: span.tags ? tagsToAttributes(span.tags) : [],
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
      status: getOTLPStatus(span),
      events: getOTLPEvents(span.logs),
      links: getOTLPReferences(span.references),
    });
  }

  return result;
}

function getOTLPSpanKind(kind: string): collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind | undefined {
  if (!kind) {
    return undefined;
  }
  const { SpanKind } = collectorTypes.opentelemetryProto.trace.v1.Span;
  switch (kind) {
    case 'server':
      return SpanKind.SPAN_KIND_SERVER;
    case 'client':
      return SpanKind.SPAN_KIND_CLIENT;
    case 'producer':
      return SpanKind.SPAN_KIND_PRODUCER;
    case 'consumer':
      return SpanKind.SPAN_KIND_CONSUMER;
    case 'internal':
      return SpanKind.SPAN_KIND_INTERNAL;
    default:
      return undefined;
  }
}

function tagsToAttributes(tags: TraceKeyValuePair[]): collectorTypes.opentelemetryProto.common.v1.KeyValue[] {
  return tags.reduce<collectorTypes.opentelemetryProto.common.v1.KeyValue[]>(
    (attributes, tag) => [...attributes, { key: tag.key, value: toAttributeValue(tag) }],
    []
  );
}

function toAttributeValue(tag: TraceKeyValuePair): collectorTypes.opentelemetryProto.common.v1.AnyValue {
  if (typeof tag.value === 'string') {
    return { stringValue: tag.value };
  } else if (typeof tag.value === 'boolean') {
    return { boolValue: tag.value };
  } else if (typeof tag.value === 'number') {
    if (tag.value % 1 === 0) {
      return { intValue: tag.value };
    } else {
      return { doubleValue: tag.value };
    }
  } else if (typeof tag.value === 'object') {
    if (Array.isArray(tag.value)) {
      const values: collectorTypes.opentelemetryProto.common.v1.AnyValue[] = [];
      for (const val of tag.value) {
        values.push(toAttributeValue(val));
      }
      return { arrayValue: { values } };
    }
  }
  return { stringValue: tag.value };
}

function getOTLPStatus(span: TraceSpanRow): SpanStatus | undefined {
  let status = undefined;
  if (span.statusCode !== undefined) {
    status = {
      code: span.statusCode,
      message: span.statusMessage ? span.statusMessage : '',
    };
  }
  return status;
}

function getOTLPEvents(logs: TraceLog[]): collectorTypes.opentelemetryProto.trace.v1.Span.Event[] | undefined {
  if (!logs || !logs.length) {
    return undefined;
  }

  let events: collectorTypes.opentelemetryProto.trace.v1.Span.Event[] = [];
  for (const log of logs) {
    let event: collectorTypes.opentelemetryProto.trace.v1.Span.Event = {
      timeUnixNano: log.timestamp * 1000000,
      attributes: [],
      droppedAttributesCount: 0,
      name: log.name || '',
    };
    for (const field of log.fields) {
      event.attributes!.push({
        key: field.key,
        value: toAttributeValue(field),
      });
    }
    events.push(event);
  }
  return events;
}

function getOTLPReferences(
  references: TraceSpanReference[]
): collectorTypes.opentelemetryProto.trace.v1.Span.Link[] | undefined {
  if (!references || !references.length) {
    return undefined;
  }

  let links: collectorTypes.opentelemetryProto.trace.v1.Span.Link[] = [];
  for (const ref of references) {
    let link: collectorTypes.opentelemetryProto.trace.v1.Span.Link = {
      traceId: ref.traceID,
      spanId: ref.spanID,
      attributes: [],
      droppedAttributesCount: 0,
    };
    if (ref.tags?.length) {
      for (const tag of ref.tags) {
        link.attributes?.push({
          key: tag.key,
          value: toAttributeValue(tag),
        });
      }
    }
    links.push(link);
  }
  return links;
}

import {
  ArrayVector,
  DataFrame,
  DataQueryResponse,
  DataSourceInstanceSettings,
  Field,
  FieldType,
  MutableDataFrame,
  TraceKeyValuePair,
  TraceLog,
  TraceSpanRow,
} from '@grafana/data';
import { SpanKind, SpanStatus, SpanStatusCode } from '@opentelemetry/api';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createGraphFrames } from './graphTransform';

export function createTableFrame(
  logsFrame: DataFrame,
  datasourceUid: string,
  datasourceName: string,
  traceRegexs: string[]
): DataFrame {
  const tableFrame = new MutableDataFrame({
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {
          custom: {
            width: 150,
          },
        },
      },
      {
        name: 'traceID',
        type: FieldType.string,
        config: {
          displayNameFromDS: 'Trace ID',
          custom: { width: 300 },
          links: [
            {
              title: 'Click to open trace ${__value.raw}',
              url: '',
              internal: {
                datasourceUid,
                datasourceName,
                query: {
                  query: '${__value.raw}',
                },
              },
            },
          ],
        },
      },
      {
        name: 'Message',
        type: FieldType.string,
      },
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  });

  if (!logsFrame || traceRegexs.length === 0) {
    return tableFrame;
  }

  const timeField = logsFrame.fields.find((f) => f.type === FieldType.time);

  // Going through all string fields to look for trace IDs
  for (let field of logsFrame.fields) {
    let hasMatch = false;
    if (field.type === FieldType.string) {
      const values = field.values.toArray();
      for (let i = 0; i < values.length; i++) {
        const line = values[i];
        if (line) {
          for (let traceRegex of traceRegexs) {
            const match = (line as string).match(traceRegex);
            if (match) {
              const traceId = match[1];
              const time = timeField ? timeField.values.get(i) : null;
              tableFrame.fields[0].values.add(time);
              tableFrame.fields[1].values.add(traceId);
              tableFrame.fields[2].values.add(line);
              hasMatch = true;
            }
          }
        }
      }
    }
    if (hasMatch) {
      break;
    }
  }

  return tableFrame;
}

export function transformTraceList(
  response: DataQueryResponse,
  datasourceId: string,
  datasourceName: string,
  traceRegexs: string[]
): DataQueryResponse {
  response.data.forEach((data, index) => {
    const frame = createTableFrame(data, datasourceId, datasourceName, traceRegexs);
    response.data[index] = frame;
  });
  return response;
}

// Don't forget to change the backend code when the id representation changed
function transformBase64IDToHexString(base64: string) {
  const raw = atob(base64);
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const hex = raw.charCodeAt(i).toString(16);
    result += hex.length === 2 ? hex : '0' + hex;
  }

  return result.length > 16 ? result.slice(16) : result;
}

function transformHexStringToBase64ID(hex: string) {
  const hexArray = hex.match(/\w{2}/g) || [];
  return btoa(
    hexArray
      .map(function (a) {
        return String.fromCharCode(parseInt(a, 16));
      })
      .join('')
  );
}

function getAttributeValue(value: collectorTypes.opentelemetryProto.common.v1.AnyValue): any {
  if (value.stringValue) {
    return value.stringValue;
  }

  if (value.boolValue !== undefined) {
    return Boolean(value.boolValue);
  }

  if (value.intValue !== undefined) {
    return Number.parseInt(value.intValue as any, 10);
  }

  if (value.doubleValue) {
    return Number.parseFloat(value.doubleValue as any);
  }

  if (value.arrayValue) {
    const arrayValue = [];
    for (const arValue of value.arrayValue.values) {
      arrayValue.push(getAttributeValue(arValue));
    }
    return arrayValue;
  }

  return '';
}

function resourceToProcess(resource: collectorTypes.opentelemetryProto.resource.v1.Resource | undefined) {
  const serviceTags: TraceKeyValuePair[] = [];
  let serviceName = 'OTLPResourceNoServiceName';
  if (!resource) {
    return { serviceName, serviceTags };
  }

  for (const attribute of resource.attributes) {
    if (attribute.key === SemanticResourceAttributes.SERVICE_NAME) {
      serviceName = attribute.value.stringValue || serviceName;
    }
    serviceTags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
  }

  return { serviceName, serviceTags };
}

function getSpanTags(
  span: collectorTypes.opentelemetryProto.trace.v1.Span,
  instrumentationLibrary?: collectorTypes.opentelemetryProto.common.v1.InstrumentationLibrary
): TraceKeyValuePair[] {
  const spanTags: TraceKeyValuePair[] = [];

  if (instrumentationLibrary) {
    if (instrumentationLibrary.name) {
      spanTags.push({ key: 'otel.library.name', value: instrumentationLibrary.name });
    }
    if (instrumentationLibrary.version) {
      spanTags.push({ key: 'otel.library.version', value: instrumentationLibrary.version });
    }
  }

  if (span.attributes) {
    for (const attribute of span.attributes) {
      spanTags.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
    }
  }

  if (span.status) {
    if (span.status.code && (span.status.code as any) !== SpanStatusCode.UNSET) {
      spanTags.push({
        key: 'otel.status_code',
        value: SpanStatusCode[span.status.code],
      });
      if (span.status.message) {
        spanTags.push({ key: 'otel.status_description', value: span.status.message });
      }
    }
    if (span.status.code === SpanStatusCode.ERROR) {
      spanTags.push({ key: 'error', value: true });
    }
  }

  if (
    span.kind !== undefined &&
    span.kind !== collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind.SPAN_KIND_INTERNAL
  ) {
    spanTags.push({
      key: 'span.kind',
      value: SpanKind[collectorTypes.opentelemetryProto.trace.v1.Span.SpanKind[span.kind] as any].toLowerCase(),
    });
  }

  return spanTags;
}

function getLogs(span: collectorTypes.opentelemetryProto.trace.v1.Span) {
  const logs: TraceLog[] = [];
  if (span.events) {
    for (const event of span.events) {
      const fields: TraceKeyValuePair[] = [];
      if (event.attributes) {
        for (const attribute of event.attributes) {
          fields.push({ key: attribute.key, value: getAttributeValue(attribute.value) });
        }
      }
      logs.push({ fields, timestamp: event.timeUnixNano / 1000000 });
    }
  }

  return logs;
}

export function transformFromOTLP(
  traceData: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
  nodeGraph = false
): DataQueryResponse {
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
      custom: {
        traceFormat: 'otlp',
      },
    },
  });
  try {
    for (const data of traceData) {
      const { serviceName, serviceTags } = resourceToProcess(data.resource);
      for (const librarySpan of data.instrumentationLibrarySpans) {
        for (const span of librarySpan.spans) {
          frame.add({
            traceID: transformBase64IDToHexString(span.traceId),
            spanID: transformBase64IDToHexString(span.spanId),
            parentSpanID: transformBase64IDToHexString(span.parentSpanId || ''),
            operationName: span.name || '',
            serviceName,
            serviceTags,
            startTime: span.startTimeUnixNano! / 1000000,
            duration: (span.endTimeUnixNano! - span.startTimeUnixNano!) / 1000000,
            tags: getSpanTags(span, librarySpan.instrumentationLibrary),
            logs: getLogs(span),
          } as TraceSpanRow);
        }
      }
    }
  } catch (error) {
    return { error: { message: 'JSON is not valid OpenTelemetry format' }, data: [] };
  }

  let data = [frame];
  if (nodeGraph) {
    data.push(...(createGraphFrames(frame) as MutableDataFrame[]));
  }

  return { data };
}

/**
 * Transforms trace dataframes to the OpenTelemetry format
 */
export function transformToOTLP(
  data: MutableDataFrame
): { batches: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[] } {
  let result: { batches: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[] } = {
    batches: [],
  };

  // Lookup object to see which batch contains spans for which services
  let services: { [key: string]: number } = {};

  for (let i = 0; i < data.length; i++) {
    const span = data.get(i);

    // Group spans based on service
    if (!services[span.serviceName]) {
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
      let libraryName = span.tags.find((t: TraceKeyValuePair) => t.key === 'otel.library.name')?.value;
      if (libraryName) {
        result.batches[batchIndex].instrumentationLibrarySpans[0].instrumentationLibrary = {
          name: libraryName,
          version: span.tags.find((t: TraceKeyValuePair) => t.key === 'otel.library.version')?.value,
        };
      }
    }

    result.batches[batchIndex].instrumentationLibrarySpans[0].spans.push({
      traceId: transformHexStringToBase64ID(span.traceID.padStart(32, '0')),
      spanId: transformHexStringToBase64ID(span.spanID),
      traceState: '',
      parentSpanId: transformHexStringToBase64ID(span.parentSpanID || ''),
      name: span.operationName,
      kind: getOTLPSpanKind(span.tags) as any,
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: (span.startTime + span.duration) * 1000000,
      attributes: tagsToAttributes(span.tags),
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
      status: getOTLPStatus(span.tags),
      events: getOTLPEvents(span.logs),
    });
  }

  return result;
}

function getOTLPSpanKind(tags: TraceKeyValuePair[]): string | undefined {
  let spanKind = undefined;
  const spanKindTagValue = tags.find((t) => t.key === 'span.kind')?.value;
  switch (spanKindTagValue) {
    case 'server':
      spanKind = 'SPAN_KIND_SERVER';
      break;
    case 'client':
      spanKind = 'SPAN_KIND_CLIENT';
      break;
    case 'producer':
      spanKind = 'SPAN_KIND_PRODUCER';
      break;
    case 'consumer':
      spanKind = 'SPAN_KIND_CONSUMER';
      break;
  }

  return spanKind;
}

/**
 * Converts key-value tags to OTLP attributes and removes tags added by Grafana
 */
function tagsToAttributes(tags: TraceKeyValuePair[]): collectorTypes.opentelemetryProto.common.v1.KeyValue[] {
  return tags
    .filter(
      (t) =>
        ![
          'span.kind',
          'otel.library.name',
          'otel.libary.version',
          'otel.status_description',
          'otel.status_code',
        ].includes(t.key)
    )
    .reduce<collectorTypes.opentelemetryProto.common.v1.KeyValue[]>(
      (attributes, tag) => [...attributes, { key: tag.key, value: toAttributeValue(tag) }],
      []
    );
}

/**
 * Returns the correct OTLP AnyValue based on the value of the tag value
 */
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

function getOTLPStatus(tags: TraceKeyValuePair[]): SpanStatus | undefined {
  let status = undefined;
  const statusCodeTag = tags.find((t) => t.key === 'otel.status_code');
  if (statusCodeTag) {
    status = {
      code: statusCodeTag.value,
      message: tags.find((t) => t.key === 'otel_status_description')?.value,
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
      name: '',
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

export function transformTrace(response: DataQueryResponse, nodeGraph = false): DataQueryResponse {
  // We need to parse some of the fields which contain stringified json.
  // Seems like we can't just map the values as the frame we got from backend has some default processing
  // and will stringify the json back when we try to set it. So we create a new field and swap it instead.
  const frame: DataFrame = response.data[0];

  if (!frame) {
    return emptyDataQueryResponse;
  }

  parseJsonFields(frame);

  let data = [...response.data];
  if (nodeGraph) {
    data.push(...createGraphFrames(frame));
  }

  return {
    ...response,
    data,
  };
}

/**
 * Change fields which are json string into JS objects. Modifies the frame in place.
 */
function parseJsonFields(frame: DataFrame) {
  for (const fieldName of ['serviceTags', 'logs', 'tags']) {
    const field = frame.fields.find((f) => f.name === fieldName);
    if (field) {
      const fieldIndex = frame.fields.indexOf(field);
      const values = new ArrayVector();
      const newField: Field = {
        ...field,
        values,
        type: FieldType.other,
      };

      for (let i = 0; i < field.values.length; i++) {
        const value = field.values.get(i);
        values.set(i, value === '' ? undefined : JSON.parse(value));
      }
      frame.fields[fieldIndex] = newField;
    }
  }
}

type SearchResponse = {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano: string;
  durationMs: number;
};

export function createTableFrameFromSearch(data: SearchResponse[], instanceSettings: DataSourceInstanceSettings) {
  const frame = new MutableDataFrame({
    fields: [
      {
        name: 'traceID',
        type: FieldType.string,
        config: {
          displayNameFromDS: 'Trace ID',
          links: [
            {
              title: 'Trace: ${__value.raw}',
              url: '',
              internal: {
                datasourceUid: instanceSettings.uid,
                datasourceName: instanceSettings.name,
                query: {
                  query: '${__value.raw}',
                  queryType: 'traceId',
                },
              },
            },
          ],
        },
      },
      { name: 'traceName', type: FieldType.string, config: { displayNameFromDS: 'Trace name' } },
      { name: 'startTime', type: FieldType.time, config: { displayNameFromDS: 'Start time' } },
      { name: 'duration', type: FieldType.number, config: { displayNameFromDS: 'Duration', unit: 'ms' } },
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  });
  if (!data?.length) {
    return frame;
  }
  // Show the most recent traces
  const traceData = data.map(transformToTraceData).sort((a, b) => b?.startTime! - a?.startTime!);

  for (const trace of traceData) {
    frame.add(trace);
  }

  return frame;
}

function transformToTraceData(data: SearchResponse) {
  let traceName = '';
  if (data.rootServiceName) {
    traceName += data.rootServiceName + ' ';
  }
  if (data.rootTraceName) {
    traceName += data.rootTraceName;
  }
  return {
    traceID: data.traceID,
    startTime: parseInt(data.startTimeUnixNano, 10) / 1000 / 1000,
    duration: data.durationMs,
    traceName,
  };
}

const emptyDataQueryResponse = {
  data: [
    new MutableDataFrame({
      fields: [
        {
          name: 'trace',
          type: FieldType.trace,
          values: [],
        },
      ],
      meta: {
        preferredVisualisationType: 'trace',
        custom: {
          traceFormat: 'otlp',
        },
      },
    }),
  ],
};

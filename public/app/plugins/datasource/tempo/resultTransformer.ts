import {
  ArrayVector,
  DataFrame,
  DataQueryResponse,
  Field,
  FieldType,
  MutableDataFrame,
  TraceKeyValuePair,
  TraceLog,
  TraceSpanRow,
} from '@grafana/data';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { collectorTypes } from '@opentelemetry/exporter-collector';
import { ResourceAttributes } from '@opentelemetry/semantic-conventions';
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
  const buffer = Buffer.from(base64, 'base64');
  const id = buffer.toString('hex');
  return id.length > 16 ? id.slice(16) : id;
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
    if (attribute.key === ResourceAttributes.SERVICE_NAME) {
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
  traceData: collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[]
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
    },
  });

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

  return { data: [frame, ...createGraphFrames(frame)] };
}

export function transformTrace(response: DataQueryResponse): DataQueryResponse {
  // We need to parse some of the fields which contain stringified json.
  // Seems like we can't just map the values as the frame we got from backend has some default processing
  // and will stringify the json back when we try to set it. So we create a new field and swap it instead.
  const frame: DataFrame = response.data[0];

  if (!frame) {
    return emptyDataQueryResponse;
  }

  parseJsonFields(frame);

  return {
    ...response,
    data: [...response.data, ...createGraphFrames(frame)],
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
      },
    }),
  ],
};

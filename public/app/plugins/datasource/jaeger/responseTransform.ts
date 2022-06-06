import {
  DataFrame,
  DataSourceInstanceSettings,
  FieldType,
  MutableDataFrame,
  TraceLog,
  TraceSpanRow,
} from '@grafana/data';
import { transformTraceData } from '@jaegertracing/jaeger-ui-components';

import { JaegerResponse, Span, TraceProcess, TraceResponse } from './types';

export function createTraceFrame(data: TraceResponse): DataFrame {
  const spans = data.spans.map((s) => toSpanRow(s, data.processes));

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
      { name: 'warnings', type: FieldType.other },
      { name: 'stackTraces', type: FieldType.other },
    ],
    meta: {
      preferredVisualisationType: 'trace',
      custom: {
        traceFormat: 'jaeger',
      },
    },
  });

  for (const span of spans) {
    frame.add(span);
  }

  return frame;
}

function toSpanRow(span: Span, processes: Record<string, TraceProcess>): TraceSpanRow {
  return {
    spanID: span.spanID,
    traceID: span.traceID,
    parentSpanID: span.references?.find((r) => r.refType === 'CHILD_OF')?.spanID,
    operationName: span.operationName,
    // from micro to millis
    startTime: span.startTime / 1000,
    duration: span.duration / 1000,
    logs: span.logs.map((l) => ({
      ...l,
      timestamp: l.timestamp / 1000,
    })),
    tags: span.tags,
    warnings: span.warnings ?? undefined,
    stackTraces: span.stackTraces,
    serviceName: processes[span.processID].serviceName,
    serviceTags: processes[span.processID].tags,
  };
}

export function createTableFrame(data: TraceResponse[], instanceSettings: DataSourceInstanceSettings): DataFrame {
  const frame = new MutableDataFrame({
    fields: [
      {
        name: 'traceID',
        type: FieldType.string,
        config: {
          unit: 'string',
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
                },
              },
            },
          ],
        },
      },
      { name: 'traceName', type: FieldType.string, config: { displayNameFromDS: 'Trace name' } },
      { name: 'startTime', type: FieldType.time, config: { displayNameFromDS: 'Start time' } },
      { name: 'duration', type: FieldType.number, config: { displayNameFromDS: 'Duration', unit: 'µs' } },
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  });
  // Show the most recent traces
  const traceData = data.map(transformToTraceData).sort((a, b) => b?.startTime! - a?.startTime!);

  for (const trace of traceData) {
    frame.add(trace);
  }

  return frame;
}

function transformToTraceData(data: TraceResponse) {
  const traceData = transformTraceData(data);
  if (!traceData) {
    return;
  }

  return {
    traceID: traceData.traceID,
    startTime: traceData.startTime / 1000,
    duration: traceData.duration,
    traceName: traceData.traceName,
  };
}

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

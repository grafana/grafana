import { collectorTypes } from '@opentelemetry/exporter-collector';

import {
  FieldType,
  MutableDataFrame,
  PluginType,
  DataSourceInstanceSettings,
  dateTime,
  ArrayVector,
  PluginMetaInfo,
} from '@grafana/data';

import {
  createTableFrame,
  transformToOTLP,
  transformFromOTLP,
  createTableFrameFromSearch,
  createTableFrameFromTraceQlQuery,
} from './resultTransformer';
import {
  badOTLPResponse,
  otlpDataFrameToResponse,
  otlpDataFrameFromResponse,
  otlpResponse,
  tempoSearchResponse,
  traceQlResponse,
} from './testResponse';
import { TraceSearchMetadata } from './types';

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'tempo',
  access: 'proxy',
  meta: {
    id: 'tempo',
    name: 'tempo',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  readOnly: false,
  jsonData: {},
};

describe('transformTraceList()', () => {
  const lokiDataFrame = new MutableDataFrame({
    fields: [
      {
        name: 'ts',
        type: FieldType.time,
        values: ['2020-02-12T15:05:14.265Z', '2020-02-12T15:05:15.265Z', '2020-02-12T15:05:16.265Z'],
      },
      {
        name: 'line',
        type: FieldType.string,
        values: [
          't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server',
          't=2020-02-12T15:04:52+0000 lvl=info msg="Starting Grafana" logger=server traceID=asdfa1234',
          't=2020-02-12T15:04:53+0000 lvl=info msg="Starting Grafana" logger=server traceID=asdf88',
        ],
      },
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  });

  test('extracts traceIDs from log lines', () => {
    const frame = createTableFrame(lokiDataFrame, 't1', 'tempo', ['traceID=(\\w+)', 'traceID=(\\w\\w)']);
    expect(frame.fields[0].name).toBe('Time');
    expect(frame.fields[0].values.get(0)).toBe('2020-02-12T15:05:15.265Z');
    expect(frame.fields[1].name).toBe('traceID');
    expect(frame.fields[1].values.get(0)).toBe('asdfa1234');
    // Second match in new line
    expect(frame.fields[0].values.get(1)).toBe('2020-02-12T15:05:15.265Z');
    expect(frame.fields[1].values.get(1)).toBe('as');
  });
});

describe('transformToOTLP()', () => {
  test('transforms dataframe to OTLP format', () => {
    const otlp = transformToOTLP(otlpDataFrameToResponse);
    expect(otlp).toMatchObject(otlpResponse);
  });
});

describe('transformFromOTLP()', () => {
  test('transforms OTLP format to dataFrame', () => {
    const res = transformFromOTLP(
      otlpResponse.batches as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );
    expect(res.data[0]).toMatchObject({
      ...otlpDataFrameFromResponse,
      creator: expect.any(Function),
    });
  });
});

describe('createTableFrameFromSearch()', () => {
  const mockTimeUnix = dateTime(1643357709095).valueOf();
  global.Date.now = jest.fn(() => mockTimeUnix);
  test('transforms search response to dataFrame', () => {
    const frame = createTableFrameFromSearch(tempoSearchResponse.traces as TraceSearchMetadata[], defaultSettings);
    expect(frame.fields[0].name).toBe('traceID');
    expect(frame.fields[0].values.get(0)).toBe('e641dcac1c3a0565');

    // TraceID must have unit = 'string' to prevent the ID from rendering as Infinity
    expect(frame.fields[0].config.unit).toBe('string');

    expect(frame.fields[1].name).toBe('traceName');
    expect(frame.fields[1].values.get(0)).toBe('c10d7ca4e3a00354 ');

    expect(frame.fields[2].name).toBe('startTime');
    expect(frame.fields[2].values.get(0)).toBe('2022-01-28 03:00:28');
    expect(frame.fields[2].values.get(1)).toBe('2022-01-27 22:56:06');

    expect(frame.fields[3].name).toBe('traceDuration');
    expect(frame.fields[3].values.get(0)).toBe(65);
  });
});

describe('createTableFrameFromTraceQlQuery()', () => {
  test('transforms TraceQL response to DataFrame', () => {
    const frameList = createTableFrameFromTraceQlQuery(traceQlResponse.traces, defaultSettings);
    const frame = frameList[0];
    // Trace ID field
    expect(frame.fields[0].name).toBe('traceID');
    expect(frame.fields[0].values.get(0)).toBe('b1586c3c8c34d');
    expect(frame.fields[0].config.unit).toBe('string');
    expect(frame.fields[0].values).toBeInstanceOf(ArrayVector);
    // Start time field
    expect(frame.fields[1].name).toBe('startTime');
    expect(frame.fields[1].type).toBe('string');
    expect(frame.fields[1].values.get(1)).toBe('2022-01-27 22:56:06');
    expect(frame.fields[1].values).toBeInstanceOf(ArrayVector);
    // Trace name field
    expect(frame.fields[2].name).toBe('traceName');
    expect(frame.fields[2].type).toBe('string');
    expect(frame.fields[2].values.get(0)).toBe('lb HTTP Client');
    expect(frame.fields[2].values).toBeInstanceOf(ArrayVector);
    // Duration field
    expect(frame.fields[3].name).toBe('traceDuration');
    expect(frame.fields[3].type).toBe('number');
    expect(frame.fields[3].values.get(2)).toBe(44);
  });
});

describe('transformFromOTLP()', () => {
  // Mock the console error so that running the test suite doesnt throw the error
  const origError = console.error;
  const consoleErrorMock = jest.fn();
  afterEach(() => (console.error = origError));
  beforeEach(() => (console.error = consoleErrorMock));

  test('if passed bad data, will surface an error', () => {
    const res = transformFromOTLP(
      badOTLPResponse.batches as unknown as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );

    expect(res.data[0]).toBeFalsy();
    expect(res.error?.message).toBeTruthy();
    // if it does have resources, no error will be thrown
    expect({
      ...res.data[0],
      resources: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'db' } },
          { key: 'job', value: { stringValue: 'tns/db' } },
          { key: 'opencensus.exporterversion', value: { stringValue: 'Jaeger-Go-2.22.1' } },
          { key: 'host.name', value: { stringValue: '63d16772b4a2' } },
          { key: 'ip', value: { stringValue: '0.0.0.0' } },
          { key: 'client-uuid', value: { stringValue: '39fb01637a579639' } },
        ],
      },
    }).not.toBeFalsy();
  });
});

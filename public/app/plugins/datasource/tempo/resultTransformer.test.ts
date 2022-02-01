import { FieldType, MutableDataFrame, PluginType, DataSourceInstanceSettings, dateTime } from '@grafana/data';
import {
  SearchResponse,
  createTableFrame,
  transformToOTLP,
  transformFromOTLP,
  createTableFrameFromSearch,
} from './resultTransformer';
import { otlpDataFrameToResponse, otlpDataFrameFromResponse, otlpResponse, tempoSearchResponse } from './testResponse';
import { collectorTypes } from '@opentelemetry/exporter-collector';

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
      (otlpResponse.batches as unknown) as collectorTypes.opentelemetryProto.trace.v1.ResourceSpans[],
      false
    );
    expect(res.data[0]).toMatchObject(otlpDataFrameFromResponse);
  });
});

describe('createTableFrameFromSearch()', () => {
  const mockTimeUnix = dateTime(1643357709095).valueOf();
  global.Date.now = jest.fn(() => mockTimeUnix);
  test('transforms search response to dataFrame', () => {
    const frame = createTableFrameFromSearch(tempoSearchResponse.traces as SearchResponse[], defaultSettings);
    expect(frame.fields[0].name).toBe('traceID');
    expect(frame.fields[0].values.get(0)).toBe('e641dcac1c3a0565');

    expect(frame.fields[1].name).toBe('traceName');
    expect(frame.fields[1].values.get(0)).toBe('c10d7ca4e3a00354 ');

    // expect time in ago format if startTime less than 1 hour
    expect(frame.fields[2].name).toBe('startTime');
    expect(frame.fields[2].values.get(0)).toBe('15 minutes ago');

    // expect time in format if startTime greater than 1 hour
    expect(frame.fields[2].values.get(1)).toBe('2022-01-27 22:56:06');

    expect(frame.fields[3].name).toBe('duration');
    expect(frame.fields[3].values.get(0)).toBe(65);
  });
});

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
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
};

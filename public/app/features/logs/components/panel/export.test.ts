import { DataFrameType, FieldType, LogLevel, LogsSortOrder, type DataSourceApi, toDataFrame } from '@grafana/data';

import { createLogLine } from '../mocks/logRow';

import { buildLogLineFullJsonObject, formatGroupedLabelsForJson } from './export';

function typedDs(getLabelDisplayTypeFromFrame: (key: string) => string | null): DataSourceApi {
  return { getLabelDisplayTypeFromFrame } as unknown as DataSourceApi;
}

function untypedDs(): DataSourceApi {
  return {} as DataSourceApi;
}

describe('formatGroupedLabelsForJson', () => {
  it('returns a flat map when every label is in the unnamed category', () => {
    const grouped = {
      '': [
        { key: 'z', value: 'last' },
        { key: 'a', value: 'first' },
      ],
    };
    expect(formatGroupedLabelsForJson(grouped)).toEqual({
      a: 'first',
      z: 'last',
    });
  });

  it('returns nested objects per category when at least one label has a named type', () => {
    const grouped = {
      '': [{ key: 'lonely', value: 'x' }],
      Indexed: [
        { key: 'job', value: 'api' },
        { key: 'instance', value: '1' },
      ],
      'Structured metadata': [{ key: 'trace_id', value: 'abc' }],
    };
    expect(formatGroupedLabelsForJson(grouped)).toEqual({
      uncategorized: { lonely: 'x' },
      Indexed: { instance: '1', job: 'api' },
      'Structured metadata': { trace_id: 'abc' },
    });
  });

  it('parses stringified JSON label values into objects', () => {
    const grouped = {
      '': [{ key: 'payload', value: '{"nested":true,"n":1}' }],
    };
    expect(formatGroupedLabelsForJson(grouped)).toEqual({
      payload: { nested: true, n: expect.anything() },
    });
    expect((formatGroupedLabelsForJson(grouped) as { payload: { n: unknown } }).payload.n).toEqual(
      expect.objectContaining({ value: '1' })
    );
  });
});

describe('buildLogLineFullJsonObject', () => {
  const processOpts = {
    escape: false,
    order: LogsSortOrder.Descending,
    timeZone: 'utc',
    wrapLogMessage: true,
  };

  it('exports dataframe fields but omits labels when the row has no labels', () => {
    const log = createLogLine(
      {
        labels: {},
        entry: 'hello',
        logLevel: LogLevel.info,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000] },
            { name: 'Line', type: FieldType.string, values: ['hello'] },
            { name: 'labels', type: FieldType.other, values: [{}] },
            { name: 'region', type: FieldType.string, values: ['eu-west-1'] },
          ],
        }),
      },
      processOpts
    );

    const json = buildLogLineFullJsonObject(log, untypedDs());

    expect(json.labels).toBeUndefined();
    expect(json.fields).toEqual({ region: 'eu-west-1' });
    expect(json.line).toBe('hello');
  });

  it('groups labels by category when the datasource exposes label display types', () => {
    const log = createLogLine(
      {
        labels: { alpha: '1', beta: '2' },
        entry: 'msg',
        logLevel: LogLevel.warn,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [2000] },
            { name: 'Line', type: FieldType.string, values: ['msg'] },
            { name: 'labels', type: FieldType.other, values: [{ alpha: '1', beta: '2' }] },
          ],
        }),
      },
      processOpts
    );

    const ds = typedDs((key) => (key === 'alpha' ? 'Indexed labels' : 'Structured metadata'));

    expect(buildLogLineFullJsonObject(log, ds).labels).toEqual({
      'Indexed labels': { alpha: '1' },
      'Structured metadata': { beta: '2' },
    });
  });

  it('exports a flat labels object when every label type is empty (uncategorized)', () => {
    const log = createLogLine(
      {
        labels: { service: 'checkout', env: 'prod' },
        entry: 'msg',
        logLevel: LogLevel.info,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [3000] },
            { name: 'Line', type: FieldType.string, values: ['msg'] },
            {
              name: 'labels',
              type: FieldType.other,
              values: [{ service: 'checkout', env: 'prod' }],
            },
          ],
        }),
      },
      processOpts
    );

    const ds = typedDs(() => null);

    expect(buildLogLineFullJsonObject(log, ds).labels).toEqual({
      env: 'prod',
      service: 'checkout',
    });
  });

  it('prettifies stringified JSON in log line labels when types are flat', () => {
    const raw = '{"k":"v"}';
    const log = createLogLine(
      {
        labels: { meta: raw },
        entry: 'line',
        logLevel: LogLevel.debug,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [4000] },
            { name: 'Line', type: FieldType.string, values: ['line'] },
            { name: 'labels', type: FieldType.other, values: [{ meta: raw }] },
          ],
        }),
      },
      processOpts
    );

    const labels = buildLogLineFullJsonObject(
      log,
      typedDs(() => null)
    ).labels as Record<string, unknown>;
    expect(labels.meta).toEqual({ k: 'v' });
  });

  it('prettifies a single field value when the field has one stringified JSON value', () => {
    const log = createLogLine(
      {
        labels: {},
        entry: 'ok',
        logLevel: LogLevel.info,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000] },
            { name: 'Line', type: FieldType.string, values: ['ok'] },
            { name: 'labels', type: FieldType.other, values: [{}] },
            { name: 'ctx', type: FieldType.string, values: ['{"x":1}'] },
          ],
        }),
      },
      processOpts
    );

    expect(buildLogLineFullJsonObject(log, untypedDs()).fields).toEqual({
      ctx: { x: expect.anything() },
    });
  });

  it('exports fields with many values as a raw string array (no per-value JSON prettify)', () => {
    const log = createLogLine(
      {
        labels: {},
        entry: 'e',
        logLevel: LogLevel.info,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [1] },
            { name: 'Line', type: FieldType.string, values: ['e'] },
            { name: 'labels', type: FieldType.other, values: [{}] },
          ],
        }),
      },
      processOpts
    );

    const spy = jest
      .spyOn(log, 'fields', 'get')
      .mockReturnValue([{ keys: ['tags'], values: ['{"a":1}', '{"b":2}', 'plain'], fieldIndex: 10, links: [] }]);

    expect(buildLogLineFullJsonObject(log, untypedDs()).fields).toEqual({
      tags: ['{"a":1}', '{"b":2}', 'plain'],
    });

    spy.mockRestore();
  });

  it('omits dataframe fields for dataplane LogLines frames (fields come from labels / line only)', () => {
    const log = createLogLine(
      {
        labels: { app: 'store' },
        entry: 'buy',
        logLevel: LogLevel.info,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          meta: { type: DataFrameType.LogLines },
          fields: [
            { name: 'timestamp', type: FieldType.time, values: [6000] },
            { name: 'body', type: FieldType.string, values: ['buy'] },
            { name: 'labels', type: FieldType.other, values: [{ app: 'store' }] },
            { name: 'extra', type: FieldType.string, values: ['ignored-for-export'] },
          ],
        }),
      },
      processOpts
    );

    const out = buildLogLineFullJsonObject(
      log,
      typedDs(() => null)
    );
    expect(out.fields).toBeUndefined();
    expect(out.labels).toEqual({ app: 'store' });
  });

  it('prettifies the log line when the row is detected as JSON', () => {
    const entry = '{"message":"ping"}';
    const log = createLogLine(
      {
        labels: {},
        entry,
        raw: entry,
        logLevel: LogLevel.info,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          refId: 'A',
          fields: [
            { name: 'Time', type: FieldType.time, values: [7000] },
            { name: 'Line', type: FieldType.string, values: [entry] },
            { name: 'labels', type: FieldType.other, values: [{}] },
          ],
        }),
      },
      processOpts
    );

    void log.body;
    expect(log.isJSON).toBe(true);
    const line = buildLogLineFullJsonObject(log, untypedDs()).line as Record<string, unknown>;
    expect(line.message).toBe('ping');
  });
});

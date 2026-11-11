import {
  type DataFrame,
  DataFrameType,
  type DataQueryResponse,
  type Field,
  FieldType,
  LoadingState,
  type PanelData,
  type QueryResultMetaStat,
  getDefaultTimeRange,
} from '@grafana/data';

import { cloneQueryResponse, combinePanelData, combineResponses } from './combineResponses';

describe('cloneQueryResponse', () => {
  const { logFrameA } = getMockFrames();
  const responseA: DataQueryResponse = {
    data: [logFrameA],
  };
  it('clones query responses', () => {
    const clonedA = cloneQueryResponse(responseA);
    expect(clonedA).not.toBe(responseA);
    expect(clonedA).toEqual(clonedA);
  });
});

describe('combineResponses', () => {
  it('combines logs frames', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('combines logs frames with transformed fields', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    const { logFrameB: originalLogFrameB } = getMockFrames();

    // Pseudo shuffle fields
    logFrameB.fields.sort((a: Field, b: Field) => (a.name < b.name ? -1 : 1));
    expect(logFrameB.fields).not.toEqual(originalLogFrameB.fields);

    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('does not silently drop a field that only exists in the newly fetched frame', () => {
    const { logFrameA, logFrameB } = getMockFrames();

    // Simulates infinite-scroll fetching an older page (logFrameB) whose documents contain a
    // field the already-displayed page (logFrameA) doesn't have, e.g. an Elasticsearch
    // response where only some matched documents carry a given field.
    logFrameB.fields.push({
      name: 'extraField',
      type: FieldType.string,
      config: {},
      values: ['extraB1', 'extraB2'],
    });

    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };

    const combined = combineResponses(responseA, responseB);
    const extraField = combined.data[0].fields.find((field: Field) => field.name === 'extraField');

    expect(extraField).toBeDefined();
    expect(extraField?.values).toEqual(['extraB1', 'extraB2', undefined, undefined]);
  });

  it('pads a field missing from a later page so prepended rows do not reuse its earlier values', () => {
    const { logFrameA, logFrameB } = getMockFrames();

    // Page 2 introduces a field page 1 does not have. A third page then omits it again.
    // New rows are prepended, so the copied field has to grow by the same number of
    // empty values or its old values sit on the newest log lines.
    logFrameB.fields.push({
      name: 'extraField',
      type: FieldType.string,
      config: {},
      values: ['extraB1', 'extraB2'],
    });

    const withExtra = combineResponses({ data: [logFrameA] }, { data: [logFrameB] });

    const { logFrameA: laterPage } = getMockFrames();
    laterPage.fields[0].values = [5, 6];
    laterPage.fields[1].values = ['line5', 'line6'];
    laterPage.fields[3].values = ['5000000', '6000000'];
    laterPage.fields[4].values = ['id5', 'id6'];

    const combined = combineResponses(withExtra, { data: [laterPage] });
    const lineField = combined.data[0].fields.find((field: Field) => field.name === 'Line');
    const extraField = combined.data[0].fields.find((field: Field) => field.name === 'extraField');

    expect(combined.data[0].length).toBe(6);
    expect(lineField?.values).toEqual(['line5', 'line6', 'line3', 'line4', 'line1', 'line2']);
    expect(extraField?.values).toEqual([undefined, undefined, 'extraB1', 'extraB2', undefined, undefined]);
  });

  it('keeps a field introduced in the middle of the newly fetched frame', () => {
    // `extraField` occupies an index that dest already uses for `Line`. Copying source fields
    // only into empty slots drops it and can duplicate the shifted field at the end instead.
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11, 33] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line1', 'line3'] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id1', 'id3'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [22] },
        { name: 'extraField', type: FieldType.string, config: {}, values: ['extra'] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line2'] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id2'] },
      ],
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const fields = combined.data[0].fields;

    expect(fields.map((field: Field) => field.name)).toEqual(['Time', 'Line', 'id', 'extraField']);
    expect(fields.find((field: Field) => field.name === 'Time')?.values).toEqual([22, 11, 33]);
    expect(fields.find((field: Field) => field.name === 'Line')?.values).toEqual(['line2', 'line1', 'line3']);
    expect(fields.find((field: Field) => field.name === 'id')?.values).toEqual(['id2', 'id1', 'id3']);
    expect(fields.find((field: Field) => field.name === 'extraField')?.values).toEqual(['extra', undefined, undefined]);
  });

  it('keeps a field that replaces another field when both frames have the same field count', () => {
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11, 33] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line1', 'line3'] },
        { name: 'fieldA', type: FieldType.string, config: {}, values: ['a1', 'a3'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [22] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line2'] },
        { name: 'fieldB', type: FieldType.string, config: {}, values: ['b2'] },
      ],
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const fields = combined.data[0].fields;

    expect(fields.map((field: Field) => field.name)).toEqual(['Time', 'Line', 'fieldA', 'fieldB']);
    expect(fields.find((field: Field) => field.name === 'Time')?.values).toEqual([22, 11, 33]);
    expect(fields.find((field: Field) => field.name === 'Line')?.values).toEqual(['line2', 'line1', 'line3']);
    expect(fields.find((field: Field) => field.name === 'fieldA')?.values).toEqual([undefined, 'a1', 'a3']);
    expect(fields.find((field: Field) => field.name === 'fieldB')?.values).toEqual(['b2', undefined, undefined]);
  });

  it('keeps a same-named field with different labels when it replaces another at the same count', () => {
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11, 33] },
        { name: 'Value', type: FieldType.number, config: {}, values: [1, 3], labels: { level: 'debug' } },
        { name: 'Value', type: FieldType.number, config: {}, values: [10, 30], labels: { only: 'dest' } },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [22] },
        { name: 'Value', type: FieldType.number, config: {}, values: [2], labels: { level: 'debug' } },
        { name: 'Value', type: FieldType.number, config: {}, values: [20], labels: { only: 'source' } },
      ],
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const fields = combined.data[0].fields;

    expect(fields.map((field: Field) => field.labels)).toEqual([
      undefined,
      { level: 'debug' },
      { only: 'dest' },
      { only: 'source' },
    ]);
    expect(fields[1].values).toEqual([2, 1, 3]);
    expect(fields[2].values).toEqual([undefined, 10, 30]);
    expect(fields[3].values).toEqual([20, undefined, undefined]);
  });

  it('does not pair a dest field with an unrelated source field when no field by that name exists in source', () => {
    // `onlyInDest` sits where `id` sits in the source frame. A positional fallback with
    // zero name matches would copy `id` into `onlyInDest` instead of leaving it empty
    // for the prepended row.
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [22, 33] },
        { name: 'onlyInDest', type: FieldType.string, config: {}, values: ['d1', 'd2'] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id2', 'id3'] },
      ],
      meta: {
        custom: {
          frameType: 'LabeledTimeValues',
        },
      },
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id1'] },
      ],
      meta: {
        custom: {
          frameType: 'LabeledTimeValues',
        },
      },
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const timeField = combined.data[0].fields.find((field: Field) => field.name === 'Time');
    const idField = combined.data[0].fields.find((field: Field) => field.name === 'id');
    const onlyInDest = combined.data[0].fields.find((field: Field) => field.name === 'onlyInDest');

    expect(combined.data[0].length).toBe(3);
    expect(timeField?.values).toEqual([11, 22, 33]);
    expect(idField?.values).toEqual(['id1', 'id2', 'id3']);
    expect(onlyInDest?.values).toEqual([undefined, 'd1', 'd2']);
  });

  it('combines metric frames', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
              labels: {
                level: 'debug',
              },
            },
          ],
          length: 4,
          meta: {
            type: 'timeseries-multi',
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('combines and identifies new frames in the response', () => {
    const { metricFrameA, metricFrameB, metricFrameC } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB, metricFrameC],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
              labels: {
                level: 'debug',
              },
            },
          ],
          length: 4,
          meta: {
            type: 'timeseries-multi',
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
        metricFrameC,
      ],
    });
  });

  it('combines frames prioritizing refIds over names', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const dataFrameA = {
      ...metricFrameA,
      refId: 'A',
      name: 'A',
    };
    const dataFrameB = {
      ...metricFrameB,
      refId: 'B',
      name: 'A',
    };
    const responseA: DataQueryResponse = {
      data: [dataFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [dataFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [dataFrameA, dataFrameB],
    });
  });

  it('combines frames in a new response instance', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(null, responseA)).not.toBe(responseA);
    expect(combineResponses(null, responseB)).not.toBe(responseB);
  });

  it('combine when first param has errors', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const errorA = {
      message: 'errorA',
    };
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
      error: errorA,
      errors: [errorA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };

    const combined = combineResponses(responseA, responseB);
    expect(combined.data[0].length).toBe(4);
    expect(combined.error?.message).toBe('errorA');
    expect(combined.errors).toHaveLength(1);
    expect(combined.errors?.[0]?.message).toBe('errorA');
  });

  it('combine when second param has errors', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const errorB = {
      message: 'errorB',
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
      error: errorB,
      errors: [errorB],
    };

    const combined = combineResponses(responseA, responseB);
    expect(combined.data[0].length).toBe(4);
    expect(combined.error?.message).toBe('errorB');
    expect(combined.errors).toHaveLength(1);
    expect(combined.errors?.[0]?.message).toBe('errorB');
  });

  it('combine when both params have errors', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    const errorA = {
      message: 'errorA',
    };
    const errorB = {
      message: 'errorB',
    };
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
      error: errorA,
      errors: [errorA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
      error: errorB,
      errors: [errorB],
    };

    const combined = combineResponses(responseA, responseB);
    expect(combined.data[0].length).toBe(4);
    expect(combined.error?.message).toBe('errorA');
    expect(combined.errors).toHaveLength(2);
    expect(combined.errors?.[0]?.message).toBe('errorA');
    expect(combined.errors?.[1]?.message).toBe('errorB');
  });

  it('pads nanoseconds for a timestamp column whose source index differs from its destination index', () => {
    // eventTime is source index 2 and is appended at destination index 3.
    // otherTime occupies that destination index in the source frame and has different fractions.
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11, 33] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line1', 'line3'] },
        { name: 'oldField', type: FieldType.string, config: {}, values: ['old1', 'old3'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [22] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line2'] },
        { name: 'eventTime', type: FieldType.time, config: {}, values: [2200], nanos: [456789] },
        { name: 'otherTime', type: FieldType.time, config: {}, values: [3300], nanos: [111111] },
      ],
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const fields = combined.data[0].fields;
    const eventTime = fields.find((field: Field) => field.name === 'eventTime');
    const otherTime = fields.find((field: Field) => field.name === 'otherTime');

    expect(fields.map((field: Field) => field.name)).toEqual(['Time', 'Line', 'oldField', 'eventTime', 'otherTime']);
    expect(eventTime?.values).toEqual([2200, undefined, undefined]);
    expect(eventTime?.nanos).toEqual([456789, undefined, undefined]);
    expect(otherTime?.values).toEqual([3300, undefined, undefined]);
    expect(otherTime?.nanos).toEqual([111111, undefined, undefined]);
  });

  it('combines frames with nanoseconds', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    logFrameA.fields[0].nanos = [333333, 444444];
    logFrameB.fields[0].nanos = [111111, 222222];
    const responseA: DataQueryResponse = {
      data: [logFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [logFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1, 2, 3, 4],
              nanos: [111111, 222222, 333333, 444444],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  describe('combine stats', () => {
    const { metricFrameA } = getMockFrames();
    const makeResponse = (stats?: QueryResultMetaStat[]): DataQueryResponse => ({
      data: [
        {
          ...metricFrameA,
          meta: {
            ...metricFrameA.meta,
            stats,
          },
        },
      ],
    });
    it('two values', () => {
      const responseA = makeResponse([
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);
      const responseB = makeResponse([
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
      ]);

      expect(combineResponses(responseA, responseB).data[0].meta.stats).toStrictEqual([
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 33 },
      ]);
    });

    it('one value', () => {
      const responseA = makeResponse([
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);
      const responseB = makeResponse();

      expect(combineResponses(responseA, responseB).data[0].meta.stats).toStrictEqual([
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);

      expect(combineResponses(responseB, responseA).data[0].meta.stats).toStrictEqual([
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ]);
    });

    it('no value', () => {
      const responseA = makeResponse();
      const responseB = makeResponse();
      expect(combineResponses(responseA, responseB).data[0].meta.stats).toHaveLength(0);
    });
  });

  it('does not combine frames with different refId', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    metricFrameA.refId = 'A';
    metricFrameB.refId = 'B';
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [metricFrameA, metricFrameB],
    });
  });

  it('does not combine frames with different refId', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();
    metricFrameA.name = 'A';
    metricFrameB.name = 'B';
    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };
    expect(combineResponses(responseA, responseB)).toEqual({
      data: [metricFrameA, metricFrameB],
    });
  });

  it('when fields with the same name are present, uses labels to find the right field to combine', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();

    metricFrameA.fields.push({
      name: 'Value',
      type: FieldType.number,
      config: {},
      values: [9, 8],
      labels: {
        test: 'true',
      },
    });
    metricFrameB.fields.push({
      name: 'Value',
      type: FieldType.number,
      config: {},
      values: [11, 10],
      labels: {
        test: 'true',
      },
    });

    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };

    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
              labels: {
                level: 'debug',
              },
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [11, 10, 9, 8],
              labels: {
                test: 'true',
              },
            },
          ],
          length: 4,
          meta: {
            type: 'timeseries-multi',
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });

  it('when fields with the same name are present and labels are not present, falls back to indexes', () => {
    const { metricFrameA, metricFrameB } = getMockFrames();

    delete metricFrameA.fields[1].labels;
    delete metricFrameB.fields[1].labels;

    metricFrameA.fields.push({
      name: 'Value',
      type: FieldType.number,
      config: {},
      values: [9, 8],
    });
    metricFrameB.fields.push({
      name: 'Value',
      type: FieldType.number,
      config: {},
      values: [11, 10],
    });

    const responseA: DataQueryResponse = {
      data: [metricFrameA],
    };
    const responseB: DataQueryResponse = {
      data: [metricFrameB],
    };

    expect(combineResponses(responseA, responseB)).toEqual({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1000000, 2000000, 3000000, 4000000],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [6, 7, 5, 4],
            },
            {
              config: {},
              name: 'Value',
              type: 'number',
              values: [11, 10, 9, 8],
            },
          ],
          length: 4,
          meta: {
            type: 'timeseries-multi',
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
    });
  });
});

describe('combinePanelData', () => {
  it('combines series within PanelData instances', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    const panelDataA: PanelData = {
      state: LoadingState.Done,
      series: [logFrameA],
      timeRange: getDefaultTimeRange(),
    };
    const panelDataB: PanelData = {
      state: LoadingState.Done,
      series: [logFrameB],
      timeRange: getDefaultTimeRange(),
    };
    expect(combinePanelData(panelDataA, panelDataB)).toEqual({
      state: panelDataA.state,
      series: [
        {
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: [1, 2, 3, 4],
            },
            {
              config: {},
              name: 'Line',
              type: 'string',
              values: ['line3', 'line4', 'line1', 'line2'],
            },
            {
              config: {},
              name: 'labels',
              type: 'other',
              values: [
                {
                  otherLabel: 'other value',
                },
                {
                  label: 'value',
                },
                {
                  otherLabel: 'other value',
                },
              ],
            },
            {
              config: {},
              name: 'tsNs',
              type: 'string',
              values: ['1000000', '2000000', '3000000', '4000000'],
            },
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['id3', 'id4', 'id1', 'id2'],
            },
          ],
          length: 4,
          meta: {
            custom: {
              frameType: 'LabeledTimeValues',
            },
            stats: [
              {
                displayName: 'Summary: total bytes processed',
                unit: 'decbytes',
                value: 33,
              },
            ],
          },
          refId: 'A',
        },
      ],
      timeRange: panelDataA.timeRange,
    });
  });
});

export function getMockFrames() {
  const logFrameA: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3, 4],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['line1', 'line2'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            label: 'value',
          },
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['3000000', '4000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id1', 'id2'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
        { displayName: 'Ingester: total reached', value: 1 },
      ],
    },
    length: 2,
  };

  const logFrameB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1, 2],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['line3', 'line4'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['1000000', '2000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id3', 'id4'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
        { displayName: 'Ingester: total reached', value: 2 },
      ],
    },
    length: 2,
  };

  const metricFrameA: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3000000, 4000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [5, 4],
        labels: {
          level: 'debug',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ],
    },
    length: 2,
  };

  const metricFrameB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1000000, 2000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [6, 7],
        labels: {
          level: 'debug',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
      ],
    },
    length: 2,
  };

  const metricFrameC: DataFrame = {
    refId: 'A',
    name: 'some-time-series',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3000000, 4000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [6, 7],
        labels: {
          level: 'error',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 33 },
      ],
    },
    length: 2,
  };

  return {
    logFrameA,
    logFrameB,
    metricFrameA,
    metricFrameB,
    metricFrameC,
  };
}

import {
  type DataFrame,
  type DataQueryResponse,
  type Field,
  FieldType,
  type QueryResultMetaNotice,
  type QueryResultMetaStat,
} from '@grafana/data';
import { combineResponses } from 'app/features/loki-helpers/mergeResponses';
import { getMockFrames } from 'app/features/loki-helpers/mocks';

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
            notices: [],
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
            notices: [],
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

  it('keeps a newly fetched field aligned by row when page sizes differ and the new row lands in the middle', () => {
    // dest has more rows than source, and source's single new row sorts between two existing
    // dest rows rather than at either end, so a field only present in source must be padded to
    // dest's own row count (not source's) and spliced at the matching time-sorted position.
    const dest: DataFrame = {
      refId: 'A',
      length: 3,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11, 22, 33] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id1', 'id2', 'id3'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [23] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id4'] },
        { name: 'extraField', type: FieldType.string, config: {}, values: ['extraB1'] },
      ],
    };

    const responseA: DataQueryResponse = { data: [dest] };
    const responseB: DataQueryResponse = { data: [source] };

    const combined = combineResponses(responseA, responseB);
    const timeField = combined.data[0].fields.find((field: Field) => field.name === 'Time');
    const extraField = combined.data[0].fields.find((field: Field) => field.name === 'extraField');

    expect(timeField?.values).toEqual([11, 22, 23, 33]);
    expect(extraField).toBeDefined();
    expect(extraField?.values).toEqual([undefined, undefined, 'extraB1', undefined]);
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
    expect(fields.find((field: Field) => field.name === 'Time')?.values).toEqual([11, 22, 33]);
    expect(fields.find((field: Field) => field.name === 'Line')?.values).toEqual(['line1', 'line2', 'line3']);
    expect(fields.find((field: Field) => field.name === 'id')?.values).toEqual(['id1', 'id2', 'id3']);
    expect(fields.find((field: Field) => field.name === 'extraField')?.values).toEqual([undefined, 'extra', undefined]);
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
    expect(fields.find((field: Field) => field.name === 'Time')?.values).toEqual([11, 22, 33]);
    expect(fields.find((field: Field) => field.name === 'Line')?.values).toEqual(['line1', 'line2', 'line3']);
    expect(fields.find((field: Field) => field.name === 'fieldA')?.values).toEqual(['a1', undefined, 'a3']);
    expect(fields.find((field: Field) => field.name === 'fieldB')?.values).toEqual([undefined, 'b2', undefined]);
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
    expect(fields[1].values).toEqual([1, 2, 3]);
    expect(fields[2].values).toEqual([10, undefined, 30]);
    expect(fields[3].values).toEqual([undefined, 20, undefined]);
  });

  it('does not pair a dest field with an unrelated source field when no field by that name exists in source', () => {
    // `onlyInDest` doesn't exist in `source` at all. findSourceField's positional fallback is
    // meant to disambiguate same-named fields, but it also fires when there are zero name
    // matches, so it incorrectly pairs `onlyInDest` with whatever field happens to share its
    // numeric index in `source.fields` (`id`, here) and merges that field's values into it.
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [22, 33] },
        { name: 'onlyInDest', type: FieldType.string, config: {}, values: ['d1', 'd2'] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id2', 'id3'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 1,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [11] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id1'] },
      ],
    };

    const responseA: DataQueryResponse = { data: [dest] };
    const responseB: DataQueryResponse = { data: [source] };

    const combined = combineResponses(responseA, responseB);
    const timeField = combined.data[0].fields.find((field: Field) => field.name === 'Time');
    const idField = combined.data[0].fields.find((field: Field) => field.name === 'id');
    const onlyInDest = combined.data[0].fields.find((field: Field) => field.name === 'onlyInDest');

    // Sanity-check that the fields present in both frames still merge correctly; the bug is
    // specific to the field that only exists in dest.
    expect(timeField?.values).toEqual([11, 22, 33]);
    expect(idField?.values).toEqual(['id1', 'id2', 'id3']);

    expect(onlyInDest).toBeDefined();
    expect(onlyInDest?.values).toEqual([undefined, 'd1', 'd2']);
  });

  it('keeps a dest-only field on the overlapping row when that row is updated in place', () => {
    // Source repeats time/id 20 (updated in place) and adds time 25 (inserted between 20 and 30).
    // A field that exists only in dest must stay put on the overlapping row and gain a placeholder
    // only for the new row. Splicing on the overlap shifts d2/d3 onto the wrong rows.
    const dest: DataFrame = {
      refId: 'A',
      length: 3,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [10, 20, 30] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line1', 'line2', 'line3'] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id1', 'id2', 'id3'] },
        { name: 'onlyInDest', type: FieldType.string, config: {}, values: ['d1', 'd2', 'd3'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [20, 25] },
        { name: 'Line', type: FieldType.string, config: {}, values: ['line2-updated', 'line-new'] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id2', 'id-new'] },
      ],
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const fields = combined.data[0].fields;

    expect(fields.find((field: Field) => field.name === 'Time')?.values).toEqual([10, 20, 25, 30]);
    expect(fields.find((field: Field) => field.name === 'Line')?.values).toEqual([
      'line1',
      'line2-updated',
      'line-new',
      'line3',
    ]);
    expect(fields.find((field: Field) => field.name === 'id')?.values).toEqual(['id1', 'id2', 'id-new', 'id3']);
    expect(fields.find((field: Field) => field.name === 'onlyInDest')?.values).toEqual(['d1', 'd2', undefined, 'd3']);
    expect(combined.data[0].length).toBe(4);
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
            notices: [],
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
            notices: [],
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

  it('combine when both frames have errors', () => {
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
            notices: [],
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

  it('combines frames without nanoseconds with frames with nanoseconds', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    logFrameA.fields[0].nanos = undefined;
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
              nanos: [111111, 222222, 0, 0],
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
            notices: [],
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

  it('combines frames with nanoseconds with frames without nanoseconds', () => {
    const { logFrameA, logFrameB } = getMockFrames();
    logFrameA.fields[0].nanos = [111111, 222222];
    logFrameB.fields[0].nanos = undefined;
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
              nanos: [0, 0, 111111, 222222],
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
            notices: [],
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

  it('merges prepended nanosecond fractions for a new timestamp column and leaves the source frame unchanged', () => {
    // Dest has no timestamp column. Copying the source field keeps its nanos array, and
    // prepending the first of two rows splices that same array so the next read sees 100.
    const sourceNanos = [100, 200];
    const sourceTimestampValues = [10, 20];
    const dest: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [30, 40] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id3', 'id4'] },
      ],
    };
    const source: DataFrame = {
      refId: 'A',
      length: 2,
      fields: [
        { name: 'Time', type: FieldType.time, config: {}, values: [10, 20] },
        { name: 'id', type: FieldType.string, config: {}, values: ['id1', 'id2'] },
        {
          name: 'timestamp',
          type: FieldType.time,
          config: {},
          values: sourceTimestampValues,
          nanos: sourceNanos,
        },
      ],
    };

    const combined = combineResponses({ data: [dest] }, { data: [source] });
    const timestamp = combined.data[0].fields.find((field: Field) => field.name === 'timestamp');

    expect(timestamp?.nanos).toEqual([100, 200, 0, 0]);
    expect(sourceNanos).toEqual([100, 200]);
    expect(sourceTimestampValues).toEqual([10, 20]);
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

  describe('combine notices', () => {
    const { metricFrameA } = getMockFrames();
    const makeResponse = (notices?: QueryResultMetaNotice[]): DataQueryResponse => ({
      data: [
        {
          ...metricFrameA,
          meta: {
            ...metricFrameA.meta,
            notices,
          },
        },
      ],
    });

    it('combines notices from both frames', () => {
      const responseA = makeResponse([{ severity: 'warning', text: 'Warning from frame A' }]);
      const responseB = makeResponse([{ severity: 'info', text: 'Info from frame B' }]);

      expect(combineResponses(responseA, responseB).data[0].meta?.notices).toStrictEqual([
        { severity: 'warning', text: 'Warning from frame A' },
        { severity: 'info', text: 'Info from frame B' },
      ]);
    });

    it('deduplicates identical notices', () => {
      const responseA = makeResponse([{ severity: 'warning', text: 'Same warning' }]);
      const responseB = makeResponse([{ severity: 'warning', text: 'Same warning' }]);

      expect(combineResponses(responseA, responseB).data[0].meta?.notices).toStrictEqual([
        { severity: 'warning', text: 'Same warning' },
      ]);
    });

    it('keeps notices with same text but different severity', () => {
      const responseA = makeResponse([{ severity: 'warning', text: 'Message' }]);
      const responseB = makeResponse([{ severity: 'info', text: 'Message' }]);

      expect(combineResponses(responseA, responseB).data[0].meta?.notices).toStrictEqual([
        { severity: 'warning', text: 'Message' },
        { severity: 'info', text: 'Message' },
      ]);
    });

    it('handles one frame with notices and one without', () => {
      const responseA = makeResponse([{ severity: 'warning', text: 'Warning message' }]);
      const responseB = makeResponse();

      expect(combineResponses(responseA, responseB).data[0].meta?.notices).toStrictEqual([
        { severity: 'warning', text: 'Warning message' },
      ]);

      expect(combineResponses(responseB, responseA).data[0].meta?.notices).toStrictEqual([
        { severity: 'warning', text: 'Warning message' },
      ]);
    });

    it('returns empty array when neither frame has notices', () => {
      const responseA = makeResponse();
      const responseB = makeResponse();
      expect(combineResponses(responseA, responseB).data[0].meta?.notices).toHaveLength(0);
    });

    it('filters out null values from notices arrays', () => {
      const responseA = makeResponse([
        { severity: 'warning', text: 'Valid warning' },
        null as unknown as QueryResultMetaNotice, // Simulating the bug scenario
      ]);
      const responseB = makeResponse([{ severity: 'info', text: 'Valid info' }]);

      const result = combineResponses(responseA, responseB).data[0].meta?.notices;
      expect(result).toStrictEqual([
        { severity: 'warning', text: 'Valid warning' },
        { severity: 'info', text: 'Valid info' },
      ]);
      expect(result).not.toContainEqual(null);
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
            notices: [],
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
            notices: [],
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

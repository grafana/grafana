import {
  toDataFrame,
  ArrayVector,
  DataFrame,
  FieldType,
  toDataFrameDTO,
  DataFrameDTO,
  DataFrameType,
  getFrameDisplayName,
} from '@grafana/data';

import { prepareTimeSeriesTransformer, PrepareTimeSeriesOptions, timeSeriesFormat } from './prepareTimeSeries';

describe('Prepare time series transformer', () => {
  it('should transform wide to many', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
          { name: 'more', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
      }),
    ];

    const config: PrepareTimeSeriesOptions = {
      format: timeSeriesFormat.TimeSeriesMany,
    };

    expect(prepareTimeSeriesTransformer.transformer(config)(source)).toEqual([
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
        ],
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
        length: 6,
      }),
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
          { name: 'more', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
        length: 6,
      }),
    ]);
  });

  it('should treat string fields as labels', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 1, 2, 2] },
          { name: 'region', type: FieldType.string, values: ['a', 'b', 'a', 'b'] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40] },
          { name: 'more', type: FieldType.number, values: [2, 3, 4, 5] },
        ],
      }),
    ];

    const config: PrepareTimeSeriesOptions = {
      format: timeSeriesFormat.TimeSeriesMany,
    };

    const frames = prepareTimeSeriesTransformer.transformer(config)(source);
    expect(frames.length).toEqual(4);
    expect(
      frames.map((f) => ({
        name: getFrameDisplayName(f),
        labels: f.fields[1].labels,
        time: f.fields[0].values.toArray(),
        values: f.fields[1].values.toArray(),
      }))
    ).toMatchInlineSnapshot(`
      Array [
        Object {
          "labels": Object {
            "region": "a",
          },
          "name": "wide",
          "time": Array [
            1,
            2,
          ],
          "values": Array [
            10,
            30,
          ],
        },
        Object {
          "labels": Object {
            "region": "b",
          },
          "name": "wide",
          "time": Array [
            1,
            2,
          ],
          "values": Array [
            20,
            40,
          ],
        },
        Object {
          "labels": Object {
            "region": "a",
          },
          "name": "wide",
          "time": Array [
            1,
            2,
          ],
          "values": Array [
            2,
            4,
          ],
        },
        Object {
          "labels": Object {
            "region": "b",
          },
          "name": "wide",
          "time": Array [
            1,
            2,
          ],
          "values": Array [
            3,
            5,
          ],
        },
      ]
    `);
  });

  it('should transform all wide to many when mixed', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
          { name: 'another', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
      }),
      toDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [4, 5, 6, 7, 8, 9] },
          { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
      }),
    ];

    const config: PrepareTimeSeriesOptions = {
      format: timeSeriesFormat.TimeSeriesMany,
    };

    expect(prepareTimeSeriesTransformer.transformer(config)(source)).toEqual([
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'another', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
        length: 6,
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
      }),
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
        ],
        length: 6,
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
      }),
      toEquableDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [4, 5, 6, 7, 8, 9] },
          { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
        length: 6,
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
      }),
    ]);
  });

  it('should transform none when source only has long frames', () => {
    const source = [
      toDataFrame({
        name: 'long',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
        ],
      }),
      toDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
          { name: 'count', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
        ],
      }),
    ];

    const config: PrepareTimeSeriesOptions = {
      format: timeSeriesFormat.TimeSeriesMany,
    };

    expect(toEquableDataFrames(prepareTimeSeriesTransformer.transformer(config)(source))).toEqual(
      toEquableDataFrames(
        source.map((frame) => ({
          ...frame,
          meta: {
            type: DataFrameType.TimeSeriesMany,
          },
        }))
      )
    );
  });

  it('should return empty array when no timeseries exist', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
      }),
      toDataFrame({
        name: 'wide',
        refId: 'B',
        fields: [
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
      }),
    ];

    const config: PrepareTimeSeriesOptions = {
      format: timeSeriesFormat.TimeSeriesMany,
    };

    expect(prepareTimeSeriesTransformer.transformer(config)(source)).toEqual([]);
  });

  it('should convert long to many', () => {
    const source = [
      toDataFrame({
        name: 'long',
        refId: 'X',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 1, 2, 2, 3, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30, 40, 50, 60] },
          { name: 'region', type: FieldType.string, values: ['a', 'b', 'a', 'b', 'a', 'b'] },
        ],
      }),
    ];

    const config: PrepareTimeSeriesOptions = {
      format: timeSeriesFormat.TimeSeriesMany,
    };

    const frames = prepareTimeSeriesTransformer.transformer(config)(source);
    expect(frames).toEqual([
      toEquableDataFrame({
        name: 'long',
        refId: 'X',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', labels: { region: 'a' }, type: FieldType.number, values: [10, 30, 50] },
        ],
        length: 3,
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
      }),
      toEquableDataFrame({
        name: 'long',
        refId: 'X',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', labels: { region: 'b' }, type: FieldType.number, values: [20, 40, 60] },
        ],
        length: 3,
        meta: {
          type: DataFrameType.TimeSeriesMany,
        },
      }),
    ]);
  });
});

function toEquableDataFrame(source: any): DataFrame {
  return toDataFrame({
    meta: undefined,
    ...source,
    fields: source.fields.map((field: any) => {
      return {
        ...field,
        values: new ArrayVector(field.values),
        config: {},
      };
    }),
  });
}

function toEquableDataFrames(data: DataFrame[]): DataFrameDTO[] {
  return data.map((frame) => toDataFrameDTO(frame));
}

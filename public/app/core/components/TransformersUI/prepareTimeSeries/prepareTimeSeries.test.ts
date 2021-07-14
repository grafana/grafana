import { toDataFrame, ArrayVector, DataFrame, FieldType, toDataFrameDTO } from '@grafana/data';
import { prepareTimeSeries, timeSeriesFormat } from './prepareTimeSeries';

describe('Stretch frames transformer', () => {
  it('should stretch wide to many', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
          { name: 'more', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
      }),
    ];

    // Note that the 'text' field was removed
    expect(prepareTimeSeries(source, { format: timeSeriesFormat.TimeSeriesMany })).toEqual([
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
        ],
        length: 6,
      }),
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'more', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
        length: 6,
      }),
    ]);
  });

  it('should stretch all wide to many when mixed', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
          { name: 'another', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
      }),
      toDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 90, 80, 70, 60, 50] },
          { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
      }),
    ];

    expect(prepareTimeSeries(source, { format: timeSeriesFormat.TimeSeriesMany })).toEqual([
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
        ],
        length: 6,
      }),
      toEquableDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'another', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
        length: 6,
      }),
      toEquableDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 90, 80, 70, 60, 50] },
          { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6, 7] },
        ],
        length: 6,
      }),
    ]);
  });

  it('should stretch none when source only has long frames', () => {
    const source = [
      toDataFrame({
        name: 'long',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
        ],
      }),
      toDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'count', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
        ],
      }),
    ];

    const rsp = prepareTimeSeries(source, { format: timeSeriesFormat.TimeSeriesMany });
    expect(rsp.map((f) => toDataFrameDTO(f))).toEqual(source.map((f) => toDataFrameDTO(f)));
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

    expect(prepareTimeSeries(source, { format: timeSeriesFormat.TimeSeriesMany })).toEqual([]);
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

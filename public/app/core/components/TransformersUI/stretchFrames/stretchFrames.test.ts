import { toDataFrame, ArrayVector, DataTransformerID, DataFrame, FieldType } from '@grafana/data';
import { stretchFrames } from './stretchFrames';

describe('Stretch frames transformer', () => {
  it('should stretch wide to long', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'count', type: FieldType.string, values: [1, 2, 3, 4, 5, 6] },
        ],
      }),
    ];

    expect(stretchFrames(source)).toEqual([
      toEquableDataFrame({
        name: 'wide0',
        refId: 'A0',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
        length: 6,
      }),
      toEquableDataFrame({
        name: 'wide1',
        refId: 'A1',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'count', type: FieldType.string, values: [1, 2, 3, 4, 5, 6] },
        ],
        length: 6,
      }),
    ]);
  });

  it('should stretch all wide to long when mixed', () => {
    const source = [
      toDataFrame({
        name: 'wide',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
          { name: 'count', type: FieldType.string, values: [1, 2, 3, 4, 5, 6] },
        ],
      }),
      toDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
      }),
    ];

    expect(stretchFrames(source)).toEqual([
      toEquableDataFrame({
        name: 'wide0',
        refId: 'A0',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
        length: 6,
      }),
      toEquableDataFrame({
        name: 'wide1',
        refId: 'A1',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'count', type: FieldType.string, values: [1, 2, 3, 4, 5, 6] },
        ],
        length: 6,
      }),
      toEquableDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
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
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
      }),
      toDataFrame({
        name: 'long',
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] },
          { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c', 'b'] },
        ],
      }),
    ];

    expect(stretchFrames(source)).toEqual(source);
  });

  it('should stretch none when source only has wide frames without time field', () => {
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

    expect(stretchFrames(source)).toEqual(source);
  });
});

function toEquableDataFrame(source: any): DataFrame {
  return toDataFrame({
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

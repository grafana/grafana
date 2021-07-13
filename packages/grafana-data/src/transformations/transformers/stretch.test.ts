import { toDataFrame } from '../../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { DataFrame, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { DataTransformerConfig } from '@grafana/data';
import { stretchFramesTransformer, StretchFramesTransformerOptions } from './stretch';
import { ArrayVector } from '../../vector';

describe('Stretch frames transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([stretchFramesTransformer]);
  });

  it('should stretch wide to long', async () => {
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

    const config: DataTransformerConfig<StretchFramesTransformerOptions> = {
      id: DataTransformerID.stretchFrames,
      options: {},
    };

    await expect(transformDataFrame([config], source)).toEmitValuesWith((received) => {
      const [transformed] = received;

      expect(transformed).toEqual([
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
  });

  it('should stretch all wide to long when mixed', async () => {
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

    const config: DataTransformerConfig<StretchFramesTransformerOptions> = {
      id: DataTransformerID.stretchFrames,
      options: {},
    };

    await expect(transformDataFrame([config], source)).toEmitValuesWith((received) => {
      const [transformed] = received;

      expect(transformed).toEqual([
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
  });

  it('should stretch none when source only has long frames', async () => {
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

    const config: DataTransformerConfig<StretchFramesTransformerOptions> = {
      id: DataTransformerID.stretchFrames,
      options: {},
    };

    await expect(transformDataFrame([config], source)).toEmitValuesWith((received) => {
      const [transformed] = received;
      expect(transformed).toEqual(source);
    });
  });

  it('should stretch none when source only has wide frames without time field', async () => {
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

    const config: DataTransformerConfig<StretchFramesTransformerOptions> = {
      id: DataTransformerID.stretchFrames,
      options: {},
    };

    await expect(transformDataFrame([config], source)).toEmitValuesWith((received) => {
      const [transformed] = received;
      expect(transformed).toEqual(source);
    });
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
    meta: {
      transformations: [DataTransformerID.stretchFrames],
    },
  });
}

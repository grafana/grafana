import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { seriesToRowsTransformer, SeriesToRowsOptions } from './seriesToRows';

describe('Series to Rows', () => {
  beforeAll(() => {
    mockTransformationsRegistry([seriesToRowsTransformer]);
  });

  it('combine two series with one value', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [2000] },
        { name: 'temp', type: FieldType.number, values: [-1] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB]);
    const expected: Field[] = [
      { name: 'time', type: FieldType.time, values: new ArrayVector([1000, 2000]), config: {} },
      { name: 'metric', type: FieldType.string, values: new ArrayVector(['A-series', 'B-series']), config: {} },
      { name: 'value', type: FieldType.number, values: new ArrayVector([1, -1]), config: {} },
    ];

    console.log(
      'result',
      result[0].fields.map(field => ({
        name: field.name,
        values: field.values.toArray().join(', '),
      }))
    );
    expect(result[0].fields).toEqual(expected);
  });
});

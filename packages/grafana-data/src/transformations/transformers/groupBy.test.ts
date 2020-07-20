import { toDataFrame } from '../../dataframe/processDataFrame';
import { groupByTransformer } from './groupBy';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';

const testSeries = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
    { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
    { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
  ],
});

describe('GroupBy Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupByTransformer]);
  });

  it('should calculate the occurrences of each value of the specified field (string values)', () => {
    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        byField: 'message',
      },
    };

    const result = transformDataFrame([cfg], [testSeries]);

    const expected: Field[] = [
      {
        name: 'message',
        type: FieldType.string,
        values: new ArrayVector(['one', 'two', 'three']),
        config: { displayName: 'message' },
      },
      {
        name: 'count',
        type: FieldType.number,
        values: new ArrayVector([1, 2, 3]),
        config: { displayName: 'Number of Occurrences' },
      },
    ];

    expect(result[0].fields).toEqual(expected);
  });

  it('should calculate the occurrences of each value of the specified field (number values)', () => {
    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        byField: 'values',
      },
    };

    const result = transformDataFrame([cfg], [testSeries]);

    const expected: Field[] = [
      {
        name: 'values',
        type: FieldType.string,
        values: new ArrayVector([1, 2, 3]),
        config: { displayName: 'values' },
      },
      {
        name: 'count',
        type: FieldType.number,
        values: new ArrayVector([1, 2, 3]),
        config: { displayName: 'Number of Occurrences' },
      },
    ];

    expect(result[0].fields).toEqual(expected);
  });
});

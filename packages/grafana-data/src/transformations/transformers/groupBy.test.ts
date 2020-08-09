import { toDataFrame } from '../../dataframe/processDataFrame';
import { groupByTransformer, GroupByTransformerOptions } from './groupBy';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';
import { ReducerID } from '../fieldReducer';
import { DataTransformerConfig } from '@grafana/data';

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

  it('should group by and compute a few calculations for each group of values', () => {
    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        byField: 'message',
        calculationsByField: [
          ['time', [ReducerID.count, ReducerID.last]],
          ['values', [ReducerID.sum]],
        ],
      },
    };

    const result = transformDataFrame([cfg], [testSeries]);

    const expected: Field[] = [
      {
        name: 'message',
        type: FieldType.string,
        values: new ArrayVector(['one', 'two', 'three']),
        config: {},
      },
      {
        name: 'time (count)',
        type: FieldType.number,
        values: new ArrayVector([1, 2, 3]),
        config: {},
      },
      {
        name: 'time (last)',
        type: FieldType.number,
        values: new ArrayVector([3000, 5000, 8000]),
        config: {},
      },
      {
        name: 'values (sum)',
        type: FieldType.number,
        values: new ArrayVector([1, 4, 9]),
        config: {},
      },
    ];

    expect(result[0].fields).toEqual(expected);
  });
});

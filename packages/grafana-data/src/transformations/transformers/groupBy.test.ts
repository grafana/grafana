import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector } from '../../vector';
import { ReducerID } from '../fieldReducer';
import { transformDataFrame } from '../transformDataFrame';

import { GroupByOperationID, groupByTransformer, GroupByTransformerOptions } from './groupBy';
import { DataTransformerID } from './ids';

describe('GroupBy transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupByTransformer]);
  });

  it('should not apply transformation if config is missing group by fields', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          message: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.count],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0]).toBe(testSeries);
    });
  });

  it('should group values by message', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          message: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: new ArrayVector(['one', 'two', 'three']),
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should group values by message and summarize values', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          message: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          values: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: new ArrayVector(['one', 'two', 'three']),
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

  it('should group by and compute a few calculations for each group of values', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          message: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          time: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.count, ReducerID.last],
          },
          values: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
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
          type: FieldType.time,
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

  it('should group values in data frames individually', async () => {
    const testSeries = [
      toDataFrame({
        name: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
          { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
          { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
        ],
      }),
      toDataFrame({
        name: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
          { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
          { name: 'values', type: FieldType.string, values: [0, 2, 5, 3, 3, 2] },
        ],
      }),
    ];

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          message: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          values: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], testSeries)).toEmitValuesWith((received) => {
      const result = received[0];
      const expectedA: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: new ArrayVector(['one', 'two', 'three']),
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: new ArrayVector([1, 4, 9]),
          config: {},
        },
      ];

      const expectedB: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: new ArrayVector(['one', 'two', 'three']),
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: new ArrayVector([0, 7, 8]),
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expectedA);
      expect(result[1].fields).toEqual(expectedB);
    });
  });

  it('should group values and keep the order of the fields', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'message', type: FieldType.string, values: ['500', '404', '404', 'one', 'one', 'two', '200'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3, 4] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          message: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          values: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: new ArrayVector(['500', '404', 'one', 'two', '200']),
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: new ArrayVector([1, 4, 6, 3, 4]),
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });
});

import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType, Field } from '../../types/dataFrame';
import { DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ReducerID } from '../fieldReducer';
import { transformDataFrame } from '../transformDataFrame';

import { GroupByOperationID, groupByTransformer, GroupByTransformerOptions, shouldCalculateField } from './groupBy';
import { DataTransformerID } from './ids';

// returns a simple group by / reducer pair
const getSimpleGroupByConfig = (
  groupName: string,
  valuesName: string,
  reducer: ReducerID
): DataTransformerConfig<GroupByTransformerOptions> => {
  return {
    id: DataTransformerID.groupBy,
    options: {
      fields: {
        [groupName]: {
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
        [valuesName]: {
          operation: GroupByOperationID.aggregate,
          aggregations: [reducer],
        },
      },
    },
  };
};

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
          values: ['one', 'two', 'three'],
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
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg = getSimpleGroupByConfig('message', 'values', ReducerID.sum);

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: ['one', 'two', 'three'],
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: [1, 4, 9],
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
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
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
          values: ['one', 'two', 'three'],
          config: {},
        },
        {
          name: 'time (count)',
          type: FieldType.number,
          values: [1, 2, 3],
          config: {},
        },
        {
          name: 'time (last)',
          type: FieldType.time,
          values: [3000, 5000, 8000],
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: [1, 4, 9],
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
          { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
        ],
      }),
      toDataFrame({
        name: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
          { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
          { name: 'values', type: FieldType.number, values: [0, 2, 5, 3, 3, 2] },
        ],
      }),
    ];

    const cfg = getSimpleGroupByConfig('message', 'values', ReducerID.sum);

    await expect(transformDataFrame([cfg], testSeries)).toEmitValuesWith((received) => {
      const result = received[0];
      const expectedA: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: ['one', 'two', 'three'],
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: [1, 4, 9],
          config: {},
        },
      ];

      const expectedB: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: ['one', 'two', 'three'],
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: [0, 7, 8],
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

    const cfg = getSimpleGroupByConfig('message', 'values', ReducerID.sum);

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: ['500', '404', 'one', 'two', '200'],
          config: {},
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: [1, 4, 6, 3, 4],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should group by and skip fields that do not have values for a group', async () => {
    const testSeries1 = toDataFrame({
      name: 'Series1',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1688470200000, 1688471100000, 1688470200000, 1688471100000] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 3, 4] },
      ],
    });

    const testSeries2 = toDataFrame({
      name: 'Series2',
      fields: [
        { name: 'Time', type: FieldType.time, values: [] },
        { name: 'Value', type: FieldType.number, values: [] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          Series1: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
          Series2: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
          Time: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          Value: {
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries1, testSeries2])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'Time',
          type: FieldType.time,
          values: [1688470200000, 1688471100000],
          config: {},
        },
        {
          name: 'Value (sum)',
          type: FieldType.number,
          values: [4, 6],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should retain "time" field type when used as aggregation (max, etc)', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'user', type: FieldType.string, values: ['A', 'B', 'A', 'B'] },
        { name: 'time', type: FieldType.time, values: [7, 2, 1, 5] },
      ],
    });

    const cfg = getSimpleGroupByConfig('user', 'time', ReducerID.max);

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'user',
          type: FieldType.string,
          values: ['A', 'B'],
          config: {},
        },
        {
          name: 'time (max)',
          type: FieldType.time,
          values: [7, 5],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should retain "time" field type when used as aggregation (max, etc)', async () => {
    const testSeries = toDataFrame({
      refId: 'A',
      name: 'issues',
      fields: [
        { name: 'user', type: FieldType.string, values: ['A', 'B', 'A', 'B'] },
        { name: 'time', type: FieldType.time, values: [7, 2, 1, 5] },
      ],
    });

    const cfg = getSimpleGroupByConfig('user', 'time', ReducerID.max);

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'user',
          type: FieldType.string,
          values: ['A', 'B'],
          config: {},
        },
        {
          name: 'time (max)',
          type: FieldType.time,
          values: [7, 5],
          config: {},
        },
      ];

      expect(result[0].refId).toEqual('A');

      // adding a frame name can modify field auto-name behavior if a joinBy transformer follows, which transfers
      // the frame name to field.labels.name and calculateFieldDisplayName() may start treating it as a single-label field
      expect(result[0].name).toBeUndefined();

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should match on base name if did not match on displayName', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'message', type: FieldType.string, values: ['A', 'A'], config: { displayName: 'MyMessage' } },
        { name: 'values', type: FieldType.number, values: [1, 2] },
      ],
    });

    const cfg = getSimpleGroupByConfig('message', 'values', ReducerID.sum);

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'message',
          type: FieldType.string,
          values: ['A'],
          config: { displayName: 'MyMessage' },
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          values: [3],
          config: {},
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });

  it('should not aggregate fields without an operation', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'category', type: FieldType.string, values: ['A', 'A', 'B', 'B'], config: {} },
        { name: 'values', type: FieldType.number, values: [1, 2, 3, 4], config: {} },
      ],
    });

    // when the operation field is cleared the aggregations are kept in state in case they are needed, but they should not be used by the transformation
    let cfg = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          category: {
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          values: {
            aggregations: [ReducerID.sum],
            operation: null,
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'category',
          type: FieldType.string,
          values: ['A', 'B'],
          config: {},
        },
      ];
      expect(result[0].fields).toEqual(expected);
    });
  });

  it.only('should calculate count on a grouped field when selected', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'category', type: FieldType.string, values: ['A', 'A', 'B', 'B'], config: {} },
        { name: 'values', type: FieldType.number, values: [1, 2, 3, 4], config: {} },
      ],
    });

    let cfg = {
      id: DataTransformerID.groupBy,
      options: {
        fields: {
          category: {
            operation: GroupByOperationID.groupBy,
            aggregations: [ReducerID.count],
          },
          values: {
            operation: undefined,
          },
        },
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      const expected: Field[] = [
        {
          name: 'category',
          type: FieldType.string,
          values: ['A', 'B'],
          config: {},
        },
        {
          name: 'category (count)',
          type: FieldType.number,
          values: [2, 2],
          config: {},
        },
      ];
      expect(result[0].fields).toEqual(expected);
    });
  });
});

describe('shouldCalculateField()', () => {
  it.each([
    [GroupByOperationID.aggregate, [], false],
    [GroupByOperationID.aggregate, [ReducerID.count], true],
    [GroupByOperationID.aggregate, [ReducerID.sum, ReducerID.count], true],
    [GroupByOperationID.groupBy, [], false],
    [GroupByOperationID.groupBy, [ReducerID.count], true],
    [GroupByOperationID.groupBy, [ReducerID.sum], false],
    [GroupByOperationID.groupBy, [ReducerID.sum, ReducerID.count], false],
  ])('when provided operation %s and aggregations %s, should return %s', (operation, aggregations, expected) => {
    const field: Field = {
      name: 'testField',
      type: FieldType.string,
      config: {},
      values: [],
    };
    const options: GroupByTransformerOptions = {
      fields: { testField: { aggregations, operation } },
    };
    expect(shouldCalculateField(field, options)).toBe(expected);
  });
});

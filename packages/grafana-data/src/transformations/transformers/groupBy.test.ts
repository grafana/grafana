import { toDataFrame } from '../../dataframe/processDataFrame';
import { GroupByOperationID, groupByTransformer, GroupByTransformerOptions } from './groupBy';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';
import { Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';
import { ReducerID } from '../fieldReducer';
import { DataTransformerConfig } from '@grafana/data';
import { observableTester } from '../../utils/tests/observableTester';

describe('GroupBy transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupByTransformer]);
  });

  it('should not apply transformation if config is missing group by fields', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [testSeries]),
      expect: result => {
        expect(result[0]).toBe(testSeries);
      },
      done,
    });
  });

  it('should group values by message', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [testSeries]),
      expect: result => {
        const expected: Field[] = [
          {
            name: 'message',
            type: FieldType.string,
            values: new ArrayVector(['one', 'two', 'three']),
            config: {},
          },
        ];

        expect(result[0].fields).toEqual(expected);
      },
      done,
    });
  });

  it('should group values by message and summarize values', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [testSeries]),
      expect: result => {
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
      },
      done,
    });
  });

  it('should group by and compute a few calculations for each group of values', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [testSeries]),
      expect: result => {
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
      },
      done,
    });
  });

  it('should group values in data frames induvidually', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], testSeries),
      expect: result => {
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
      },
      done,
    });
  });
});

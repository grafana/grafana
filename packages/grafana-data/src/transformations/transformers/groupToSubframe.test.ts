import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ReducerID } from '../fieldReducer';
import { transformDataFrame } from '../transformDataFrame';

import { GroupByOperationID, GroupByTransformerOptions } from './groupBy';
import { groupToSubframeTransformer, GroupToSubframeTransformerOptions } from './groupToSubrame';
import { DataTransformerID } from './ids';

describe('GroupToSubframe transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupToSubframeTransformer]);
  });


  it('should group values by message and place values in subframe', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.string, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToSubframeTransformerOptions> = {
      id: DataTransformerID.groupToSubframe,
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
          name: 'Nested Frames',
          type: FieldType.nestedFrames,
          values: [
            [
              {
                fields: {
                  config: {},
                  name: "time",
                  type: FieldType.time,
                  values: [3000]
                }
              }
            ]
          ],
          config: {},
        },
      ];

      // console.log(result[0].fields);
      // expect(result[0].fields).toEqual("nestedFrames");
      expect(result[0].fields).toEqual(expected);
    });
  });


  it('should group by message, compute a few calculations for each group of values, and place other values in a subframe', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
        { name: 'intVal', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] }
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupToSubframe,
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

  it('should not show subframe headers if subframe headers are disabled', async () => {

  })



});

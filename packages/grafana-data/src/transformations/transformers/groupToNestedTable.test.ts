import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType, Field } from '../../types/dataFrame';
import { DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ReducerID } from '../fieldReducer';
import { transformDataFrame } from '../transformDataFrame';

import { GroupByOperationID, GroupByTransformerOptions } from './groupBy';
import { groupToNestedTable, GroupToNestedTableTransformerOptions } from './groupToNestedTable';
import { DataTransformerID } from './ids';

describe('GroupToSubframe transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupToNestedTable]);
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

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptions> = {
      id: DataTransformerID.groupToNestedTable,
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
          config: {},
          values: ['one', 'two', 'three'],
        },
        {
          name: '__nestedFrames',
          type: FieldType.nestedFrames,
          config: {},
          values: [
            [
              {
                meta: { custom: { noHeader: false } },
                length: 1,
                fields: [
                  {
                    name: 'time',
                    type: 'time',
                    config: {
                      displayName: 'time',
                    },
                    state: {
                      displayName: 'time',
                      multipleFrames: false,
                    },
                    values: [3000],
                  },
                  {
                    name: 'values',
                    type: 'string',
                    config: {
                      displayName: 'values',
                    },
                    state: {
                      displayName: 'values',
                      multipleFrames: false,
                    },
                    values: [1],
                  },
                ],
              },
            ],
            [
              {
                meta: { custom: { noHeader: false } },
                length: 2,
                fields: [
                  {
                    name: 'time',
                    type: 'time',
                    config: {
                      displayName: 'time',
                    },
                    state: {
                      displayName: 'time',
                      multipleFrames: false,
                    },
                    values: [4000, 5000],
                  },
                  {
                    name: 'values',
                    type: 'string',
                    config: {
                      displayName: 'values',
                    },
                    state: {
                      displayName: 'values',
                      multipleFrames: false,
                    },
                    values: [2, 2],
                  },
                ],
              },
            ],
            [
              {
                meta: { custom: { noHeader: false } },
                length: 3,
                fields: [
                  {
                    name: 'time',
                    type: 'time',
                    config: {
                      displayName: 'time',
                    },
                    state: {
                      displayName: 'time',
                      multipleFrames: false,
                    },
                    values: [6000, 7000, 8000],
                  },
                  {
                    name: 'values',
                    type: 'string',
                    config: {
                      displayName: 'values',
                    },
                    state: {
                      displayName: 'values',
                      multipleFrames: false,
                    },
                    values: [3, 3, 3],
                  },
                ],
              },
            ],
          ],
        },
      ];

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
        { name: 'intVal', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
        { name: 'floatVal', type: FieldType.number, values: [1.1, 2.3, 3.6, 4.8, 5.7, 6.9] },
      ],
    });

    const cfg: DataTransformerConfig<GroupByTransformerOptions> = {
      id: DataTransformerID.groupToNestedTable,
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
          config: {},
          values: ['one', 'two', 'three'],
        },
        {
          name: 'values (sum)',
          type: FieldType.number,
          config: {},
          values: [1, 4, 9],
        },
        {
          config: {},
          name: '__nestedFrames',
          type: FieldType.nestedFrames,
          values: [
            [
              {
                meta: { custom: { noHeader: false } },
                length: 1,
                fields: [
                  {
                    name: 'time',
                    type: 'time',
                    config: {
                      displayName: 'time',
                    },
                    state: {
                      displayName: 'time',
                      multipleFrames: false,
                    },
                    values: [3000],
                  },
                  {
                    name: 'intVal',
                    type: 'number',
                    config: {
                      displayName: 'intVal',
                    },
                    state: {
                      displayName: 'intVal',
                      multipleFrames: false,
                    },
                    values: [1],
                  },
                  {
                    name: 'floatVal',
                    type: 'number',
                    config: {
                      displayName: 'floatVal',
                    },
                    state: {
                      displayName: 'floatVal',
                      multipleFrames: false,
                    },
                    values: [1.1],
                  },
                ],
              },
            ],
            [
              {
                meta: { custom: { noHeader: false } },
                length: 2,
                fields: [
                  {
                    name: 'time',
                    type: 'time',
                    config: {
                      displayName: 'time',
                    },
                    state: {
                      displayName: 'time',
                      multipleFrames: false,
                    },
                    values: [4000, 5000],
                  },
                  {
                    name: 'intVal',
                    type: 'number',
                    config: {
                      displayName: 'intVal',
                    },
                    state: {
                      displayName: 'intVal',
                      multipleFrames: false,
                    },
                    values: [2, 3],
                  },
                  {
                    name: 'floatVal',
                    type: 'number',
                    config: {
                      displayName: 'floatVal',
                    },
                    state: {
                      displayName: 'floatVal',
                      multipleFrames: false,
                    },
                    values: [2.3, 3.6],
                  },
                ],
              },
            ],
            [
              {
                meta: { custom: { noHeader: false } },
                length: 3,
                fields: [
                  {
                    name: 'time',
                    type: 'time',
                    config: {
                      displayName: 'time',
                    },
                    state: {
                      displayName: 'time',
                      multipleFrames: false,
                    },
                    values: [6000, 7000, 8000],
                  },
                  {
                    name: 'intVal',
                    type: 'number',
                    config: {
                      displayName: 'intVal',
                    },
                    state: {
                      displayName: 'intVal',
                      multipleFrames: false,
                    },
                    values: [4, 5, 6],
                  },
                  {
                    name: 'floatVal',
                    type: 'number',
                    config: {
                      displayName: 'floatVal',
                    },
                    state: {
                      displayName: 'floatVal',
                      multipleFrames: false,
                    },
                    values: [4.8, 5.7, 6.9],
                  },
                ],
              },
            ],
          ],
        },
      ];

      expect(result[0].fields).toEqual(expected);
    });
  });
});

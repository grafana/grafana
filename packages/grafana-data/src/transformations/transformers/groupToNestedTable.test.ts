import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType, type Field } from '../../types/dataFrame';
import { type DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ReducerID } from '../fieldReducer';
import { FieldMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformDataFrame';

import { GroupByOperationID, type GroupByTransformerOptions } from './groupBy';
import {
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
  groupToNestedTable,
  isV1GroupToNestedTableOptions,
  migrateGroupToNestedTableOptions,
} from './groupToNestedTable';
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

describe('GroupToSubframe transformer - V2 migration', () => {
  it('migrateGroupToNestedTableOptions should convert V1 fields record to V2 rules array', () => {
    const v1Options: GroupToNestedTableTransformerOptions = {
      showSubframeHeaders: false,
      fields: {
        message: {
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
        values: {
          operation: GroupByOperationID.aggregate,
          aggregations: [ReducerID.sum, ReducerID.mean],
        },
      },
    };

    const v2 = migrateGroupToNestedTableOptions(v1Options);

    expect(v2.showSubframeHeaders).toBe(false);
    expect(v2.rules).toHaveLength(2);

    const groupByRule = v2.rules.find((r) => r.matcher.options === 'message');
    expect(groupByRule).toBeDefined();
    expect(groupByRule!.matcher.id).toBe(FieldMatcherID.byName);
    expect(groupByRule!.operation).toBe(GroupByOperationID.groupBy);
    expect(groupByRule!.aggregations).toEqual([]);

    const calcRule = v2.rules.find((r) => r.matcher.options === 'values');
    expect(calcRule).toBeDefined();
    expect(calcRule!.matcher.id).toBe(FieldMatcherID.byName);
    expect(calcRule!.operation).toBe(GroupByOperationID.aggregate);
    expect(calcRule!.aggregations).toEqual([ReducerID.sum, ReducerID.mean]);
  });

  it('should return true for V1 config and false for V2 config', () => {
    const v1: GroupToNestedTableTransformerOptions = {
      fields: { message: { operation: GroupByOperationID.groupBy, aggregations: [] } },
    };
    expect(isV1GroupToNestedTableOptions(v1)).toBe(true);
  });

  it('should return false for V2 config', () => {
    const v2: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };
    expect(isV1GroupToNestedTableOptions(v2)).toBe(false);
  });

  it('should return false if both rules and fields exist, even if fields is empty', () => {
    const v2ConfigFromV1 = {
      fields: {},
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };
    expect(isV1GroupToNestedTableOptions(v2ConfigFromV1)).toBe(false);
  });
});

describe('GroupToSubframe transformer - V2 native config', () => {
  it('should group values using a V2 byName matcher rule', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      // Outer frame should have 2 rows (one per unique group)
      expect(result[0].length).toBe(2);
      // First field is the grouped field
      expect(result[0].fields[0].name).toBe('message');
      expect(result[0].fields[0].values).toEqual(['one', 'two']);
      // Last field is nested frames
      const nestedField = result[0].fields.find((f: Field) => f.type === FieldType.nestedFrames);
      expect(nestedField).toBeDefined();
      expect(nestedField!.values).toHaveLength(2);
    });
  });

  it('should group by name and aggregate by name using V2 rules', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two', 'three', 'three', 'three'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2, 3, 3, 3] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0].length).toBe(3);

      const messageField = result[0].fields.find((f: Field) => f.name === 'message');
      expect(messageField!.values).toEqual(['one', 'two', 'three']);

      const sumField = result[0].fields.find((f: Field) => f.name === 'values (sum)');
      expect(sumField).toBeDefined();
      expect(sumField!.values).toEqual([1, 4, 9]);
    });
  });

  it('should group by type using a V2 byType matcher rule', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000] },
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            // Groups on the string field (message) by type
            matcher: { id: FieldMatcherID.byType, options: 'string' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0].length).toBe(2); // 'one', 'two' are the unique string groups
      expect(result[0].fields[0].name).toBe('message');
      expect(result[0].fields[0].values).toEqual(['one', 'two']);
    });
  });

  it('should apply the first matching rule when multiple rules match the same field', async () => {
    // findMatchingRule iterates rules in order and returns on the first match.
    // Here byName (rule index 1) and byRegexp (rule index 2) both match 'values'.
    // The byName rule comes first and has operation=aggregate, so the field is
    // aggregated and excluded from subframes. If first-match semantics were broken
    // the byRegexp rule (operation=null) would win and put the field in the subframe.
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'message', type: FieldType.string, values: ['one', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          {
            // First to match 'values' — wins
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
          {
            // Also matches 'values' via regexp — but comes second, so it loses
            matcher: { id: FieldMatcherID.byRegexp, options: '/values/' },
            operation: null,
            aggregations: [],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];

      // byName rule won — 'values' is aggregated into the outer frame
      const sumField = result[0].fields.find((f: Field) => f.name === 'values (sum)');
      expect(sumField).toBeDefined();
      expect(sumField!.values).toEqual([1, 2]);

      // Subframes should contain no fields: 'message' is grouped, 'values' is aggregated
      const nestedField = result[0].fields.find((f: Field) => f.type === FieldType.nestedFrames);
      for (const subframeGroup of nestedField!.values) {
        expect(subframeGroup[0].fields).toHaveLength(0);
      }
    });
  });

  it('should include a field in the nested table when its rule has operation=aggregate but no reducers', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          {
            // Aggregate rule with no reducers — unconfigured, so falls into nested table
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];

      // 'values' must NOT appear as an outer aggregated column
      const outerValuesField = result[0].fields.find((f: Field) => f.name.includes('values'));
      expect(outerValuesField).toBeUndefined();

      // 'values' must appear as a raw field inside the nested table
      const nestedField = result[0].fields.find((f: Field) => f.type === FieldType.nestedFrames);
      expect(nestedField).toBeDefined();

      const firstSubframe = nestedField!.values[0][0];
      const valuesInSubframe = firstSubframe.fields.find((f: Field) => f.name === 'values');
      expect(valuesInSubframe).toBeDefined();
      expect(valuesInSubframe!.values).toEqual([1]);
    });
  });

  it('should include a field in the nested table when its rule has a null operation', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          {
            // Null operation — unconfigured, so falls into nested table
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: null,
            aggregations: [],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];

      const nestedField = result[0].fields.find((f: Field) => f.type === FieldType.nestedFrames);
      expect(nestedField).toBeDefined();

      const firstSubframe = nestedField!.values[0][0];
      const valuesInSubframe = firstSubframe.fields.find((f: Field) => f.name === 'values');
      expect(valuesInSubframe).toBeDefined();
      expect(valuesInSubframe!.values).toEqual([1]);
    });
  });

  it('should include raw values in the nested table when keepNestedField is true on an aggregated field', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'message', type: FieldType.string, values: ['one', 'two', 'two'] },
        { name: 'values', type: FieldType.number, values: [1, 2, 2] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'message' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
            keepNestedField: true,
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      const result = received[0];

      // 'values (sum)' must appear as an aggregated column in the outer frame
      const sumField = result[0].fields.find((f: Field) => f.name === 'values (sum)');
      expect(sumField).toBeDefined();
      expect(sumField!.values).toEqual([1, 4]);

      // 'values' raw data must also appear in every nested subframe
      const nestedField = result[0].fields.find((f: Field) => f.type === FieldType.nestedFrames);
      expect(nestedField).toBeDefined();

      const firstSubframe = nestedField!.values[0][0];
      const valuesInFirst = firstSubframe.fields.find((f: Field) => f.name === 'values');
      expect(valuesInFirst).toBeDefined();
      expect(valuesInFirst!.values).toEqual([1]);

      const secondSubframe = nestedField!.values[1][0];
      const valuesInSecond = secondSubframe.fields.find((f: Field) => f.name === 'values');
      expect(valuesInSecond).toBeDefined();
      expect(valuesInSecond!.values).toEqual([2, 2]);
    });
  });

  it('should not process frames when no group-by rule exists in V2 config', async () => {
    const testSeries = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000] },
        { name: 'values', type: FieldType.number, values: [1] },
      ],
    });

    const cfg: DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> = {
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'values' },
            operation: GroupByOperationID.aggregate,
            aggregations: [ReducerID.sum],
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testSeries])).toEmitValuesWith((received) => {
      // Should return the original data unchanged since no group-by rule
      expect(received[0]).toEqual([testSeries]);
    });
  });
});

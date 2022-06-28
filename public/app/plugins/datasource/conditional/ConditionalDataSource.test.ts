import { dateTime } from '@grafana/data';
import { KeyValueVariableModel } from 'app/features/variables/types';

import { ConditionalDataSource, ConditionalDataSourceQuery } from './ConditionalDataSource';
import { getQueryConditionItems, queryConditionsRegistry } from './QueryConditionsRegistry';
import { ValueClickConditionOptions } from './conditions/FieldValueClickConditionEditor';
import { OPERATOR_ID } from './conditions/TimeRangeIntervalConditionEditor';
import { QueryConditionExecutionContext, QueryConditionID } from './types';

describe('ConditionalDatasource', () => {
  // eslint-disable-next-line
  const ds = new ConditionalDataSource({} as any);

  beforeAll(() => {
    queryConditionsRegistry.setInit(getQueryConditionItems);
  });

  describe('Filtering runnable queries', () => {
    it('does not filter out query without conditions ', () => {
      const timeRangeMock = {
        from: dateTime('2022-01-01'),
        to: dateTime('2022-01-15'),
        raw: {
          from: '2001-01-01',
          to: '2001-01-15',
        },
      };

      const ctx: QueryConditionExecutionContext = {
        timeRange: timeRangeMock,
        variables: [],
      };

      const result = ds.filterQueries(
        {
          refId: 'A',
          datasource: { type: 'testdata', uid: 'testdata' },
          conditions: [],
        },
        ctx
      );

      expect(result).toMatchInlineSnapshot(`
        Object {
          "applicable": true,
          "score": 0,
        }
      `);
    });

    it('filter out queries that have conditions not met', () => {
      // eslint-disable-next-line
      const ds = new ConditionalDataSource({} as any);

      const notOkCondition: ValueClickConditionOptions = {
        name: 'willNotPass',
        pattern: 'anything',
      };

      const timeRangeMock = {
        from: dateTime('2022-01-01'),
        to: dateTime('2022-01-15'),
        raw: {
          from: '2001-01-01',
          to: '2001-01-15',
        },
      };

      const ctx: QueryConditionExecutionContext = {
        timeRange: timeRangeMock,
        variables: [
          /* eslint-disable */
          {
            id: 'valueClickFieldInclude',
            name: 'valueClickFieldInclude',
            type: 'keyValue',
            current: { value: 'includeValue' },
          } as KeyValueVariableModel,
          /* eslint-enable */
        ],
      };

      const result1 = ds.filterQueries(
        {
          refId: 'A',
          datasource: { type: 'testdata', uid: 'testdata' },
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: notOkCondition,
            },
          ],
        },
        ctx
      );

      expect(result1).toMatchInlineSnapshot(`
        Object {
          "applicable": false,
          "score": 1,
        }
      `);
    });
  });

  describe('Selecting queries for execution', () => {
    describe('default query', () => {
      it('returns no query when there is no default query defined', () => {
        const targets: ConditionalDataSourceQuery[] = [
          {
            refId: 'A',
            conditions: [
              {
                id: QueryConditionID.ValueClick,
                options: { name: 'conditionName', pattern: 'conditionPattern' },
              },
            ],
          },
        ];

        const ctx: QueryConditionExecutionContext = {
          // eslint-disable-next-line
          timeRange: {} as any,
          variables: [],
        };

        const result = ds.getRunnableQueries(targets, ctx);
        expect(result).toHaveLength(0);
      });
      it('runs query without conditions when no conditions are met for other queries', () => {
        const targets: ConditionalDataSourceQuery[] = [
          // default query
          {
            refId: 'A',
            conditions: [],
          },
          {
            refId: 'B',
            conditions: [
              {
                id: QueryConditionID.ValueClick,
                options: { name: 'conditionName', pattern: 'conditionPattern' },
              },
            ],
          },
        ];

        const ctx: QueryConditionExecutionContext = {
          //eslint-disable-next-line
          timeRange: {} as any,
          variables: [],
        };

        const result = ds.getRunnableQueries(targets, ctx);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(targets[0]);
      });
      it('runs multiple queries without conditions when no conditions are met for other queries', () => {
        const targets: ConditionalDataSourceQuery[] = [
          // default query
          {
            refId: 'A',
            conditions: [],
          },
          {
            refId: 'B',
            conditions: [
              {
                id: QueryConditionID.ValueClick,
                options: { name: 'conditionName', pattern: 'conditionPattern' },
              },
            ],
          },
          {
            refId: 'C',
            conditions: [],
          },
        ];

        const ctx: QueryConditionExecutionContext = {
          // eslint-disable-next-line
          timeRange: {} as any,
          variables: [],
        };

        const result = ds.getRunnableQueries(targets, ctx);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(targets[0]);
        expect(result[1]).toEqual(targets[2]);
      });
    });
  });

  it('runs query that has conditions met', () => {
    const targets: ConditionalDataSourceQuery[] = [
      // default query
      {
        refId: 'A',
        conditions: [],
      },
      {
        refId: 'B',
        conditions: [
          {
            id: QueryConditionID.ValueClick,
            options: { name: 'conditionName', pattern: 'conditionPattern' },
          },
        ],
      },
      {
        refId: 'C',
        conditions: [
          {
            id: QueryConditionID.TimeRangeInterval,
            options: { operator: OPERATOR_ID.LessThan, interval: '1M' },
          },
        ],
      },
      {
        refId: 'D',
        conditions: [
          {
            id: QueryConditionID.TimeRangeInterval,
            options: { operator: OPERATOR_ID.GreaterThan, interval: '14d' },
          },
        ],
      },
    ];

    const timeRangeMock = {
      from: dateTime('2022-01-01'),
      to: dateTime('2022-01-15'),
      raw: {
        from: '2022-01-01',
        to: '2022-01-15',
      },
    };

    const ctx: QueryConditionExecutionContext = {
      timeRange: timeRangeMock,
      variables: [
        /* eslint-disable */
        {
          id: 'valueClickConditionName',
          name: 'valueClickConditionName',
          current: { value: 'blah' },
        } as KeyValueVariableModel,
        /* eslint-enable */
      ],
    };

    const result = ds.getRunnableQueries(targets, ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(targets[1]);
    expect(result[1]).toEqual(targets[2]);
  });

  describe('when multiple conditions met', () => {
    it('runs query that has the largest number of conditions met', () => {
      const targets: ConditionalDataSourceQuery[] = [
        // default query
        {
          refId: 'A',
          conditions: [],
        },
        {
          refId: 'B',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
          ],
        },
        {
          refId: 'C',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName1', pattern: 'conditionPattern1' },
            },
          ],
        },
      ];

      const ctx: QueryConditionExecutionContext = {
        // eslint-disable-next-line
        timeRange: {} as any,
        variables: [
          /* eslint-disable */
          {
            id: 'valueClickConditionName',
            name: 'valueClickConditionName',
            current: { value: 'blah' },
          } as KeyValueVariableModel,
          {
            id: 'valueClickConditionName1',
            name: 'valueClickConditionName1',
            current: { value: 'blah1' },
          } as KeyValueVariableModel,
          /* eslint-enable */
        ],
      };

      const result = ds.getRunnableQueries(targets, ctx);
      // We expect query C to be returned as it has the largest number of conditions met
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(targets[2]);
    });

    it('runs query that has the largest number of conditions met no matter the condition type', () => {
      const targets: ConditionalDataSourceQuery[] = [
        // default query
        {
          refId: 'A',
          conditions: [],
        },
        {
          refId: 'B',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
          ],
        },
        {
          refId: 'C',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
            {
              id: QueryConditionID.TimeRangeInterval,
              options: { operator: OPERATOR_ID.LessThan, interval: '1M' },
            },
          ],
        },
      ];

      const timeRangeMock = {
        from: dateTime('2022-01-01'),
        to: dateTime('2022-01-15'),
        raw: {
          from: '2022-01-01',
          to: '2022-01-15',
        },
      };

      const ctx: QueryConditionExecutionContext = {
        timeRange: timeRangeMock,
        variables: [
          /* eslint-disable */
          {
            id: 'valueClickConditionName',
            name: 'valueClickConditionName',
            current: { value: 'blah' },
          } as KeyValueVariableModel,
          {
            id: 'valueClickConditionName1',
            name: 'valueClickConditionName1',
            current: { value: 'blah1' },
          } as KeyValueVariableModel,
          /* eslint-enable */
        ],
      };

      const result = ds.getRunnableQueries(targets, ctx);
      // We expect query C to be returned as it has the largest number of conditions met
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(targets[2]);
    });

    it('can return multiple queries when multiple independent conditions are met', () => {
      const targets: ConditionalDataSourceQuery[] = [
        // default query
        {
          refId: 'A',
          conditions: [],
        },
        {
          refId: 'B',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
          ],
        },
        {
          refId: 'C',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
            {
              id: QueryConditionID.TimeRangeInterval,
              options: { operator: OPERATOR_ID.LessThan, interval: '1M' },
            },
          ],
        },
        {
          refId: 'D',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' },
            },
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName1', pattern: 'conditionPattern1' },
            },
          ],
        },
      ];

      const timeRangeMock = {
        from: dateTime('2022-01-01'),
        to: dateTime('2022-01-15'),
        raw: {
          from: '2022-01-01',
          to: '2022-01-15',
        },
      };

      const ctx: QueryConditionExecutionContext = {
        timeRange: timeRangeMock,
        variables: [
          /* eslint-disable */
          {
            id: 'valueClickConditionName',
            name: 'valueClickConditionName',
            current: { value: 'blah' },
          } as KeyValueVariableModel,
          {
            id: 'valueClickConditionName1',
            name: 'valueClickConditionName1',
            current: { value: 'blah1' },
          } as KeyValueVariableModel,
          /* eslint-enable */
        ],
      };

      const result = ds.getRunnableQueries(targets, ctx);

      // We expect both query C & D to be returned as they both end up having the same number of conditions met, even though the conditions are indpeendent
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(targets[2]);
      expect(result[1]).toEqual(targets[3]);
    });
  });
});

import { dateTime, QueryConditionExecutionContext, QueryConditionID } from '@grafana/data';
import { KeyValueVariableModel } from 'app/features/variables/types';
import { ConditionalDataSource, ConditionalDataSourceQuery } from './ConditionalDataSource';
import { ValueClickConditionOptions } from './conditions/FieldValueClickConditionEditor';
import { OPERATOR_ID, TimeRangeIntervalConditionOptions } from './conditions/TimeRangeIntervalConditionEditor';
import { getQueryConditionItems, queryConditionsRegistry } from './QueryConditionsRegistry';

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
          {
            id: 'valueClickFieldInclude',
            name: 'valueClickFieldInclude',
            type: 'keyValue',
            current: { value: 'includeValue' },
          } as KeyValueVariableModel,
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
        const targets: Array<ConditionalDataSourceQuery> = [
          {
            refId: 'A',
            conditions: [
              {
                id: QueryConditionID.ValueClick,
                options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
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
        const targets: Array<ConditionalDataSourceQuery> = [
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
                options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
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
        const targets: Array<ConditionalDataSourceQuery> = [
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
                options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
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
    const targets: Array<ConditionalDataSourceQuery> = [
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
            options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
          },
        ],
      },
      {
        refId: 'C',
        conditions: [
          {
            id: QueryConditionID.TimeRangeInterval,
            options: { operator: OPERATOR_ID.LessThan, interval: '1M' } as TimeRangeIntervalConditionOptions,
          },
        ],
      },
      {
        refId: 'D',
        conditions: [
          {
            id: QueryConditionID.TimeRangeInterval,
            options: { operator: OPERATOR_ID.GreaterThan, interval: '14d' } as TimeRangeIntervalConditionOptions,
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
        {
          id: 'valueClickConditionName',
          name: 'valueClickConditionName',
          current: { value: 'blah' },
        } as KeyValueVariableModel,
      ],
    };

    const result = ds.getRunnableQueries(targets, ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(targets[1]);
    expect(result[1]).toEqual(targets[2]);
  });

  describe('when multiple conditions met', () => {
    it('runs query that has the largest number of conditions met', () => {
      const targets: Array<ConditionalDataSourceQuery> = [
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
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
          ],
        },
        {
          refId: 'C',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName1', pattern: 'conditionPattern1' } as ValueClickConditionOptions,
            },
          ],
        },
      ];

      const ctx: QueryConditionExecutionContext = {
        // eslint-disable-next-line
        timeRange: {} as any,
        variables: [
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
        ],
      };

      const result = ds.getRunnableQueries(targets, ctx);
      // We expect query C to be returned as it has the largest number of conditions met
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(targets[2]);
    });

    it('runs query that has the largest number of conditions met no matter the condition type', () => {
      const targets: Array<ConditionalDataSourceQuery> = [
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
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
          ],
        },
        {
          refId: 'C',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
            {
              id: QueryConditionID.TimeRangeInterval,
              options: { operator: OPERATOR_ID.LessThan, interval: '1M' } as TimeRangeIntervalConditionOptions,
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
        ],
      };

      const result = ds.getRunnableQueries(targets, ctx);
      // We expect query C to be returned as it has the largest number of conditions met
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(targets[2]);
    });

    it('can return multiple queries when multiple independent conditions are met', () => {
      const targets: Array<ConditionalDataSourceQuery> = [
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
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
          ],
        },
        {
          refId: 'C',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
            {
              id: QueryConditionID.TimeRangeInterval,
              options: { operator: OPERATOR_ID.LessThan, interval: '1M' } as TimeRangeIntervalConditionOptions,
            },
          ],
        },
        {
          refId: 'D',
          conditions: [
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName', pattern: 'conditionPattern' } as ValueClickConditionOptions,
            },
            {
              id: QueryConditionID.ValueClick,
              options: { name: 'conditionName1', pattern: 'conditionPattern1' } as ValueClickConditionOptions,
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

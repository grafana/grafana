import { cloneDeep } from 'lodash';

import { buildRawQuery, changeGroupByPart, changeSelectPart, normalizeQuery } from './queryUtils';
import { DEFAULT_POLICY, InfluxQuery } from './types';

describe('InfluxDB query utils', () => {
  describe('buildRawQuery', () => {
    it('should handle default query', () => {
      expect(
        buildRawQuery({
          refId: 'A',
          hide: false,
          policy: DEFAULT_POLICY,
          resultFormat: 'time_series',
          orderByTime: 'ASC',
          tags: [],
          groupBy: [
            {
              type: 'time',
              params: ['$__interval'],
            },
            {
              type: 'fill',
              params: ['null'],
            },
          ],
          select: [
            [
              {
                type: 'field',
                params: ['value'],
              },
              {
                type: 'mean',
                params: [],
              },
            ],
          ],
        })
      ).toBe('SELECT mean("value") FROM "measurement" WHERE $timeFilter GROUP BY time($__interval)' + ' fill(null)');
    });
    it('should handle small query', () => {
      expect(
        buildRawQuery({
          refId: 'A',
          policy: 'autogen',
          select: [
            [
              {
                type: 'field',
                params: ['value'],
              },
            ],
          ],
          groupBy: [],
        })
      ).toBe('SELECT "value" FROM "autogen"."measurement" WHERE $timeFilter');
    });
    it('should handle string limit/slimit', () => {
      expect(
        buildRawQuery({
          refId: 'A',
          policy: 'autogen',
          select: [
            [
              {
                type: 'field',
                params: ['value'],
              },
            ],
          ],
          groupBy: [],
          limit: '12',
          slimit: '23',
        })
      ).toBe('SELECT "value" FROM "autogen"."measurement" WHERE $timeFilter LIMIT 12 SLIMIT 23');
    });
    it('should handle number limit/slimit', () => {
      expect(
        buildRawQuery({
          refId: 'A',
          policy: 'autogen',
          select: [
            [
              {
                type: 'field',
                params: ['value'],
              },
            ],
          ],
          groupBy: [],
          limit: 12,
          slimit: 23,
        })
      ).toBe('SELECT "value" FROM "autogen"."measurement" WHERE $timeFilter LIMIT 12 SLIMIT 23');
    });
    it('should handle all the tag-operators', () => {
      expect(
        buildRawQuery({
          refId: 'A',
          policy: 'autogen',
          select: [
            [
              {
                type: 'field',
                params: ['value'],
              },
            ],
          ],
          tags: [
            {
              key: 'cpu',
              operator: '=',
              value: 'cpu0',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: '!=',
              value: 'cpu0',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: '<>',
              value: 'cpu0',
            },
            {
              key: 'cpu',
              operator: '<',
              value: 'cpu0',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: '>',
              value: 'cpu0',
            },
            {
              key: 'cpu',
              operator: '=~',
              value: '/cpu0/',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: '!~',
              value: '/cpu0/',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: 'Is',
              value: 'false',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: 'Is Not',
              value: 'false',
            },
          ],
          groupBy: [],
        })
      ).toBe(
        `SELECT "value" ` +
          `FROM "autogen"."measurement" ` +
          `WHERE ("cpu" = 'cpu0' AND "cpu" != 'cpu0' AND "cpu" <> 'cpu0' AND "cpu" < cpu0 AND ` +
          `"cpu" > cpu0 AND "cpu" =~ /cpu0/ AND "cpu" !~ /cpu0/ AND "cpu" = false AND "cpu" != false) AND $timeFilter`
      );
    });
    it('should handle a complex query', () => {
      expect(
        buildRawQuery({
          alias: '',
          groupBy: [
            {
              params: ['$__interval'],
              type: 'time',
            },
            {
              params: ['cpu'],
              type: 'tag',
            },
            {
              params: ['host'],
              type: 'tag',
            },
            {
              params: ['none'],
              type: 'fill',
            },
          ],
          hide: false,
          measurement: 'cpu',
          orderByTime: 'DESC',
          policy: DEFAULT_POLICY,
          rawQuery: false,
          refId: 'A',
          resultFormat: 'time_series',
          select: [
            [
              {
                type: 'field',
                params: ['usage_idle'],
              },
              {
                type: 'mean',
                params: [],
              },
              {
                type: 'holt_winters_with_fit',
                params: ['30', '5'],
              },
            ],
            [
              {
                type: 'field',
                params: ['usage_guest'],
              },
              {
                type: 'median',
                params: [],
              },
            ],
          ],
          tags: [
            {
              key: 'cpu',
              operator: '=',
              value: 'cpu2',
            },
            {
              condition: 'OR',
              key: 'cpu',
              operator: '=',
              value: 'cpu3',
            },
            {
              condition: 'AND',
              key: 'cpu',
              operator: '=',
              value: 'cpu1',
            },
          ],
          limit: '12',
          slimit: '23',
          tz: 'UTC',
        })
      ).toBe(
        `SELECT holt_winters_with_fit(mean("usage_idle"), 30, 5), median("usage_guest") ` +
          `FROM "cpu" ` +
          `WHERE ("cpu" = 'cpu2' OR "cpu" = 'cpu3' AND "cpu" = 'cpu1') ` +
          `AND $timeFilter ` +
          `GROUP BY time($__interval), "cpu", "host" fill(none) ` +
          `ORDER BY time DESC LIMIT 12 SLIMIT 23 tz('UTC')`
      );
    });
  });

  describe('normalizeQuery', () => {
    it('should handle minimal query', () => {
      const query: InfluxQuery = {
        refId: 'A',
        policy: 'autogen',
      };

      const queryClone = cloneDeep(query);

      expect(normalizeQuery(query)).toStrictEqual({
        refId: 'A',
        policy: 'autogen',
        resultFormat: 'time_series',
        orderByTime: 'ASC',
        tags: [],
        groupBy: [
          { type: 'time', params: ['$__interval'] },
          { type: 'fill', params: ['null'] },
        ],
        select: [
          [
            { type: 'field', params: ['value'] },
            { type: 'mean', params: [] },
          ],
        ],
      });

      // make sure the call did not mutate the input
      expect(query).toStrictEqual(queryClone);
    });

    it('should not change values if they already exist', () => {
      const query: InfluxQuery = {
        refId: 'A',
        groupBy: [],
        measurement: 'cpu',
        orderByTime: 'ASC',
        policy: DEFAULT_POLICY,
        resultFormat: 'table',
        select: [
          [
            {
              type: 'field',
              params: ['usage_idle'],
            },
          ],
        ],
        tags: [],
      };

      const queryClone = cloneDeep(query);

      const result = normalizeQuery(query);

      // i will check two things:
      // 1. that the function-call does not mutate the input
      expect(query).toStrictEqual(queryClone);

      // 2. that the returned object is the same object as the object i gave it.
      //    (not just the same structure, literally the same object)
      expect(result === query).toBeTruthy();
    });
  });

  describe('changeSelectPart', () => {
    it('should handle a normal situation', () => {
      const query: InfluxQuery = {
        refId: 'A',
        select: [
          [
            {
              type: 'field',
              params: ['usage_idle'],
            },
            {
              type: 'math',
              params: [' / 5'],
            },
            {
              type: 'alias',
              params: ['test42'],
            },
          ],
          [
            {
              type: 'field',
              params: ['usage_guest'],
            },
            {
              type: 'math',
              params: ['*4'],
            },
            {
              type: 'alias',
              params: ['test43'],
            },
          ],
        ],
      };

      const queryClone = cloneDeep(query);
      const result = changeSelectPart(query, 1, 2, ['test55']);

      // make sure the input did not get mutated
      expect(query).toStrictEqual(queryClone);

      expect(result).toStrictEqual({
        refId: 'A',
        select: [
          [
            {
              type: 'field',
              params: ['usage_idle'],
            },
            {
              type: 'math',
              params: [' / 5'],
            },
            {
              type: 'alias',
              params: ['test42'],
            },
          ],
          [
            {
              type: 'field',
              params: ['usage_guest'],
            },
            {
              type: 'math',
              params: ['*4'],
            },
            {
              type: 'alias',
              params: ['test55'],
            },
          ],
        ],
      });
    });
  });

  describe('changeGroupByPart', () => {
    it('should handle a normal situation', () => {
      const query: InfluxQuery = {
        refId: 'A',
        groupBy: [
          {
            type: 'time',
            params: ['$__interval'],
          },
          {
            type: 'tag',
            params: ['host'],
          },
          {
            type: 'fill',
            params: ['none'],
          },
        ],
      };

      const queryClone = cloneDeep(query);
      const result = changeGroupByPart(query, 1, ['cpu']);

      // make sure the input did not get mutated
      expect(query).toStrictEqual(queryClone);

      expect(result).toStrictEqual({
        refId: 'A',
        groupBy: [
          {
            type: 'time',
            params: ['$__interval'],
          },
          {
            type: 'tag',
            params: ['cpu'],
          },
          {
            type: 'fill',
            params: ['none'],
          },
        ],
      });
    });
  });
});

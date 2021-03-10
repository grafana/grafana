import { cloneDeep } from 'lodash';
import { InfluxQuery } from '../types';
import { buildRawQuery, normalizeQuery } from './queryUtils';

describe('InfluxDB query utils', () => {
  describe('buildRawQuery', () => {
    it('should handle default query', () => {
      expect(
        buildRawQuery({
          refId: 'A',
          hide: false,
          policy: 'default',
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
      ).toBe('SELECT mean("value") FROM "measurement" WHERE $timeFilter GROUP BY time($__interval) fill(null)');
    });
    it('should handle small query', () => {
      expect(
        buildRawQuery({
          refId: 'A',
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
      ).toBe('SELECT "value" FROM "measurement" WHERE $timeFilter');
    });
    it('should handle string limit/slimit', () => {
      expect(
        buildRawQuery({
          refId: 'A',
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
      ).toBe('SELECT "value" FROM "measurement" WHERE $timeFilter LIMIT 12 SLIMIT 23');
    });
    it('should handle number limit/slimit', () => {
      expect(
        buildRawQuery({
          refId: 'A',
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
      ).toBe('SELECT "value" FROM "measurement" WHERE $timeFilter LIMIT 12 SLIMIT 23');
    });
    it('should handle all the tag-operators', () => {
      expect(
        buildRawQuery({
          refId: 'A',
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
          ],
          groupBy: [],
        })
      ).toBe(
        `SELECT "value" FROM "measurement" WHERE ("cpu" = 'cpu0' AND "cpu" != 'cpu0' AND "cpu" <> 'cpu0' AND "cpu" < cpu0 AND "cpu" > cpu0 AND "cpu" =~ /cpu0/ AND "cpu" !~ /cpu0/) AND $timeFilter`
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
          policy: 'default',
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
        `SELECT holt_winters_with_fit(mean("usage_idle"), 30, 5), median("usage_guest") FROM "cpu" WHERE ("cpu" = 'cpu2' OR "cpu" = 'cpu3' AND "cpu" = 'cpu1') AND $timeFilter GROUP BY time($__interval), "cpu", "host" fill(none) ORDER BY time DESC LIMIT 12 SLIMIT 23 tz('UTC')`
      );
    });
  });

  describe('normalizeQuery', () => {
    it('should handle minimal query', () => {
      expect(
        normalizeQuery({
          refId: 'A',
        })
      ).toStrictEqual({
        refId: 'A',
        policy: 'default',
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
    });

    it('should not change values if they already exist', () => {
      const query: InfluxQuery = {
        refId: 'A',
        groupBy: [],
        measurement: 'cpu',
        orderByTime: 'ASC',
        policy: 'default',
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

      // i want to make sure the code does not mutate the query
      // by any chance, so we will use a deep-clone of the query
      const cloneQuery = cloneDeep(query);

      expect(normalizeQuery(cloneQuery)).toStrictEqual(query);
    });
  });
});

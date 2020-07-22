import PostgresQuery from '../postgres_query';
import { TemplateSrv } from 'app/features/templating/template_srv';

describe('PostgresQuery', () => {
  // @ts-ignore
  const templateSrv: TemplateSrv = {
    replace: jest.fn(text => text) as any,
  };

  describe('When initializing', () => {
    it('should not be in SQL mode', () => {
      const query = new PostgresQuery({}, templateSrv);
      expect(query.target.rawQuery).toBe(false);
    });
    it('should be in SQL mode for pre query builder queries', () => {
      const query = new PostgresQuery({ rawSql: 'SELECT 1' }, templateSrv);
      expect(query.target.rawQuery).toBe(true);
    });
  });

  describe('When generating time column SQL', () => {
    const query = new PostgresQuery({}, templateSrv);

    query.target.timeColumn = 'time';
    expect(query.buildTimeColumn()).toBe('time AS "time"');
    query.target.timeColumn = '"time"';
    expect(query.buildTimeColumn()).toBe('"time" AS "time"');
  });

  describe('When generating time column SQL with group by time', () => {
    let query = new PostgresQuery(
      { timeColumn: 'time', group: [{ type: 'time', params: ['5m', 'none'] }] },
      templateSrv
    );
    expect(query.buildTimeColumn()).toBe('$__timeGroupAlias(time,5m)');
    expect(query.buildTimeColumn(false)).toBe('$__timeGroup(time,5m)');

    query = new PostgresQuery({ timeColumn: 'time', group: [{ type: 'time', params: ['5m', 'NULL'] }] }, templateSrv);
    expect(query.buildTimeColumn()).toBe('$__timeGroupAlias(time,5m,NULL)');

    query = new PostgresQuery(
      { timeColumn: 'time', timeColumnType: 'int4', group: [{ type: 'time', params: ['5m', 'none'] }] },
      templateSrv
    );
    expect(query.buildTimeColumn()).toBe('$__unixEpochGroupAlias(time,5m)');
    expect(query.buildTimeColumn(false)).toBe('$__unixEpochGroup(time,5m)');
  });

  describe('When generating metric column SQL', () => {
    const query = new PostgresQuery({}, templateSrv);

    query.target.metricColumn = 'host';
    expect(query.buildMetricColumn()).toBe('host AS metric');
    query.target.metricColumn = '"host"';
    expect(query.buildMetricColumn()).toBe('"host" AS metric');
  });

  describe('When generating value column SQL', () => {
    const query = new PostgresQuery({}, templateSrv);

    let column = [{ type: 'column', params: ['value'] }];
    expect(query.buildValueColumn(column)).toBe('value');
    column = [
      { type: 'column', params: ['value'] },
      { type: 'alias', params: ['alias'] },
    ];
    expect(query.buildValueColumn(column)).toBe('value AS "alias"');
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'aggregate', params: ['max'] },
    ];
    expect(query.buildValueColumn(column)).toBe('max(v) AS "a"');
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'window', params: ['increase'] },
    ];
    expect(query.buildValueColumn(column)).toBe(
      '(CASE WHEN v >= lag(v) OVER (ORDER BY time) ' +
        'THEN v - lag(v) OVER (ORDER BY time) ' +
        'WHEN lag(v) OVER (ORDER BY time) IS NULL THEN NULL ELSE v END) AS "a"'
    );
  });

  describe('When generating value column SQL with metric column', () => {
    const query = new PostgresQuery({}, templateSrv);
    query.target.metricColumn = 'host';

    let column = [{ type: 'column', params: ['value'] }];
    expect(query.buildValueColumn(column)).toBe('value');
    column = [
      { type: 'column', params: ['value'] },
      { type: 'alias', params: ['alias'] },
    ];
    expect(query.buildValueColumn(column)).toBe('value AS "alias"');
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'aggregate', params: ['max'] },
    ];
    expect(query.buildValueColumn(column)).toBe('max(v) AS "a"');
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'window', params: ['increase'] },
    ];
    expect(query.buildValueColumn(column)).toBe(
      '(CASE WHEN v >= lag(v) OVER (PARTITION BY host ORDER BY time) ' +
        'THEN v - lag(v) OVER (PARTITION BY host ORDER BY time) ' +
        'WHEN lag(v) OVER (PARTITION BY host ORDER BY time) IS NULL THEN NULL ELSE v END) AS "a"'
    );
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'aggregate', params: ['max'] },
      { type: 'window', params: ['increase'] },
    ];
    expect(query.buildValueColumn(column)).toBe(
      '(CASE WHEN max(v) >= lag(max(v)) OVER (PARTITION BY host ORDER BY time) ' +
        'THEN max(v) - lag(max(v)) OVER (PARTITION BY host ORDER BY time) ' +
        'WHEN lag(max(v)) OVER (PARTITION BY host ORDER BY time) IS NULL THEN NULL ELSE max(v) END) AS "a"'
    );
  });

  describe('When generating WHERE clause', () => {
    const query = new PostgresQuery({ where: [] }, templateSrv);

    expect(query.buildWhereClause()).toBe('');

    query.target.timeColumn = 't';
    query.target.where = [{ type: 'macro', name: '$__timeFilter' }];
    expect(query.buildWhereClause()).toBe('\nWHERE\n  $__timeFilter(t)');

    query.target.where = [{ type: 'expression', params: ['v', '=', '1'] }];
    expect(query.buildWhereClause()).toBe('\nWHERE\n  v = 1');

    query.target.where = [
      { type: 'macro', name: '$__timeFilter' },
      { type: 'expression', params: ['v', '=', '1'] },
    ];
    expect(query.buildWhereClause()).toBe('\nWHERE\n  $__timeFilter(t) AND\n  v = 1');
  });

  describe('When generating GROUP BY clause', () => {
    const query = new PostgresQuery({ group: [], metricColumn: 'none' }, templateSrv);

    expect(query.buildGroupClause()).toBe('');
    query.target.group = [{ type: 'time', params: ['5m'] }];
    expect(query.buildGroupClause()).toBe('\nGROUP BY 1');
    query.target.metricColumn = 'm';
    expect(query.buildGroupClause()).toBe('\nGROUP BY 1,2');
  });

  describe('When generating complete statement', () => {
    const target: any = {
      timeColumn: 't',
      table: 'table',
      select: [[{ type: 'column', params: ['value'] }]],
      where: [],
    };
    let result = 'SELECT\n  t AS "time",\n  value\nFROM table\nORDER BY 1';
    const query = new PostgresQuery(target, templateSrv);

    expect(query.buildQuery()).toBe(result);

    query.target.metricColumn = 'm';
    result = 'SELECT\n  t AS "time",\n  m AS metric,\n  value\nFROM table\nORDER BY 1,2';
    expect(query.buildQuery()).toBe(result);
  });
});

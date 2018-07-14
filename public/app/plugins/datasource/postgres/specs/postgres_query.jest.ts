import PostgresQuery from '../postgres_query';

describe('PostgresQuery', function() {
  let templateSrv = {
    replace: jest.fn(text => text),
  };

  describe('When initializing', function() {
    it('should not be in SQL mode', function() {
      let query = new PostgresQuery({}, templateSrv);
      expect(query.target.rawQuery).toBe(false);
    });
    it('should be in SQL mode for pre query builder queries', function() {
      let query = new PostgresQuery({ rawSql: 'SELECT 1' }, templateSrv);
      expect(query.target.rawQuery).toBe(true);
    });
  });

  describe('When generating time column SQL', function() {
    let query = new PostgresQuery({}, templateSrv);

    expect(query.buildTimeColumn({ timeColumn: 'time' })).toBe('time AS "time"');
    expect(query.buildTimeColumn({ timeColumn: '"time"' })).toBe('"time" AS "time"');
  });

  describe('When generating time column SQL with group by time', function() {
    let query = new PostgresQuery(
      { timeColumn: 'time', groupBy: [{ type: 'time', params: ['5m', 'none'] }] },
      templateSrv
    );
    expect(query.buildTimeColumn(query.target)).toBe('$__timeGroup(time,5m)');

    query = new PostgresQuery({ timeColumn: 'time', groupBy: [{ type: 'time', params: ['5m', 'NULL'] }] }, templateSrv);
    expect(query.buildTimeColumn(query.target)).toBe('$__timeGroup(time,5m,NULL)');
  });

  describe('When generating metric column SQL', function() {
    let query = new PostgresQuery({}, templateSrv);

    expect(query.buildMetricColumn({ metricColumn: 'host' })).toBe('host AS metric');
    expect(query.buildMetricColumn({ metricColumn: '"host"' })).toBe('"host" AS metric');
  });

  describe('When generating value column SQL', function() {
    let query = new PostgresQuery({}, templateSrv);

    let column = [{ type: 'column', params: ['value'] }];
    expect(query.buildValueColumn(query.target, column)).toBe('value');
    column = [{ type: 'column', params: ['value'] }, { type: 'alias', params: ['alias'] }];
    expect(query.buildValueColumn(query.target, column)).toBe('value AS "alias"');
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'aggregate', params: ['max'] },
    ];
    expect(query.buildValueColumn(query.target, column)).toBe('max(v) AS "a"');
    column = [
      { type: 'column', params: ['v'] },
      { type: 'alias', params: ['a'] },
      { type: 'special', params: ['increase'] },
    ];
    expect(query.buildValueColumn(query.target, column)).toBe('v - lag(v) OVER () AS "a"');
  });

  describe('When generating WHERE clause', function() {
    let query = new PostgresQuery({ where: [] }, templateSrv);
    let target;

    expect(query.buildWhereClause(query.target)).toBe('');
    target = { where: [{ type: 'macro', name: '$__timeFilter' }], timeColumn: 't' };
    expect(query.buildWhereClause(target)).toBe('\nWHERE\n  $__timeFilter(t)');
    target = { where: [{ type: 'expression', params: ['v', '=', '1'] }], timeColumn: 't' };
    expect(query.buildWhereClause(target)).toBe('\nWHERE\n  v = 1');
    target = {
      where: [{ type: 'macro', name: '$__timeFilter' }, { type: 'expression', params: ['v', '=', '1'] }],
      timeColumn: 't',
    };
    expect(query.buildWhereClause(target)).toBe('\nWHERE\n  $__timeFilter(t) AND\n  v = 1');
  });

  describe('When generating GROUP BY clause', function() {
    let query = new PostgresQuery({ groupBy: [] }, templateSrv);
    let target;

    expect(query.buildGroupByClause(query.target)).toBe('');
    target = { groupBy: [{ type: 'time', params: ['5m'] }], metricColumn: 'None' };
    expect(query.buildGroupByClause(target)).toBe('\nGROUP BY 1');
    target = { groupBy: [{ type: 'time', params: ['5m'] }], metricColumn: 'm' };
    expect(query.buildGroupByClause(target)).toBe('\nGROUP BY 1,2');
  });

  describe('When generating complete statement', function() {
    let target = {
      timeColumn: 't',
      schema: 'public',
      table: 'table',
      select: [[{ type: 'column', params: ['value'] }]],
    };
    let result = 'SELECT\n  t AS "time",\n  value\nFROM public.table\nORDER BY 1';
    let query = new PostgresQuery(target, templateSrv);

    expect(query.buildQuery(query.target)).toBe(result);
  });
});

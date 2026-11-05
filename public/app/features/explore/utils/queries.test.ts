import { getQueryExpressionText } from './queries';

describe('getQueryExpressionText', () => {
  it.each([
    [{ refId: 'A', expr: 'up' }, 'up'],
    [{ refId: 'A', rawSql: 'select 1' }, 'select 1'],
    [{ refId: 'A', rawQuery: 'SELECT mean("v")' }, 'SELECT mean("v")'],
    [{ refId: 'A', target: 'stats.a' }, 'stats.a'],
    [{ refId: 'A', expression: '$A + 1' }, '$A + 1'],
    // The common fields win over the datasource-specific ones when a query carries both.
    [{ refId: 'A', expr: 'up', expression: 'x' }, 'up'],
  ])('reads the text of %j', (query, expected) => {
    expect(getQueryExpressionText(query)).toBe(expected);
  });

  it.each([
    null,
    { refId: 'A' },
    { refId: 'A', expr: '  ' },
    // A nested query model (Azure) has no single text to show; none is better than a wrong one.
    { refId: 'A', query: { table: 't' } },
  ])('has none for %j', (query) => {
    expect(getQueryExpressionText(query)).toBeUndefined();
  });
});

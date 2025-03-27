import { SQLQuery, QueryEditorExpressionType } from '@grafana/sql';

import { toRawSql } from './sqlUtil';

describe('toRawSql should escape database names', () => {
  const query: SQLQuery = {
    dataset: 'foo',
    sql: {
      columns: [{ name: 'a', alias: 'lol', type: QueryEditorExpressionType.Function }],
    },
    refId: 'lolsob',
    table: 'table',
  };
  const queryString = toRawSql(query);
  it('should escapte database names', () => {
    expect(queryString).toContain(`FROM [${query.dataset}].${query.table}`);
  });
});

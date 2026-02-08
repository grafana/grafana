import { QueryFormat } from '@grafana/plugin-ui';

import { fetchSQLFields } from './metaSqlExpr';

const runMetaSQLExprQuery = jest.fn();

jest.mock('../ExpressionDatasource', () => ({
  dataSource: {
    runMetaSQLExprQuery: (...args: unknown[]) => runMetaSQLExprQuery(...args),
  },
}));

describe('fetchSQLFields', () => {
  beforeEach(() => {
    runMetaSQLExprQuery.mockResolvedValue({ fields: [] });
  });

  it('quotes table names with spaces when building metadata query', async () => {
    await fetchSQLFields({ table: 'gdp per capita' }, [{ refId: 'gdp per capita' }] as never);

    expect(runMetaSQLExprQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        rawSql: 'SELECT * FROM `gdp per capita` LIMIT 1',
        format: QueryFormat.Table,
      }),
      expect.anything(),
      [{ refId: 'gdp per capita' }]
    );
  });
});

import { toDataFrame } from '@grafana/data';

import { dataSource } from '../ExpressionDatasource';
import { fetchSQLFields } from './metaSqlExpr';

jest.mock('../ExpressionDatasource', () => ({
  dataSource: {
    runMetaSQLExprQuery: jest.fn(),
  },
}));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

describe('fetchSQLFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should quote table names with spaces in the query to fetch fields', async () => {
    (dataSource.runMetaSQLExprQuery as jest.Mock).mockResolvedValue(
      toDataFrame({
        fields: [{ name: 'column_a', type: 'string', values: [] }],
      })
    );

    const query = { table: 'table with spaces' };
    const queries = [{ refId: 'table with spaces' }];
    
    await fetchSQLFields(query as any, queries as any);
    
    expect(dataSource.runMetaSQLExprQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        rawSql: 'SELECT * FROM `table with spaces` LIMIT 1',
      }),
      expect.anything(),
      expect.anything()
    );
  });

  it('should return empty array if no table is selected', async () => {
    const query = {};
    const queries: any[] = [];
    
    const fields = await fetchSQLFields(query as any, queries as any);
    
    expect(fields).toEqual([]);
    expect(dataSource.runMetaSQLExprQuery).not.toHaveBeenCalled();
  });

  it('should quote field names with spaces in the returned selectable values', async () => {
    (dataSource.runMetaSQLExprQuery as jest.Mock).mockResolvedValue(
      toDataFrame({
        fields: [{ name: 'field with spaces', type: 'string', values: [] }],
      })
    );

    const query = { table: 'A' };
    const queries = [{ refId: 'A' }];
    
    const fields = await fetchSQLFields(query as any, queries as any);
    
    expect(fields).toHaveLength(1);
    expect(fields[0].value).toBe('`field with spaces`');
  });

  it('should not double-quote already quoted table names in the schema query', async () => {
    const query = { table: '`already quoted`' };
    const queries = [{ refId: '`already quoted`' }];
    
    await fetchSQLFields(query as any, queries as any);
    
    expect(dataSource.runMetaSQLExprQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        rawSql: 'SELECT * FROM `already quoted` LIMIT 1',
      }),
      expect.anything(),
      expect.anything()
    );
  });
});

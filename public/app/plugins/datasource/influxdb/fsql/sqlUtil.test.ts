import { SQLQuery } from 'app/features/plugins/sql/types';

import { QueryEditorExpressionType } from '../../../../features/plugins/sql/expressions';

import { toRawSql } from './sqlUtil';

describe('toRawSql', () => {
  it('should render sql properly', () => {
    const expected = 'SELECT host FROM iox.value1 LIMIT 50';
    const testQuery: SQLQuery = {
      refId: 'A',
      sql: {
        limit: 50,
        columns: [
          {
            parameters: [
              {
                name: 'host',
                type: QueryEditorExpressionType.FunctionParameter,
              },
            ],
            type: QueryEditorExpressionType.Function,
          },
        ],
      },
      dataset: 'iox',
      table: 'value1',
    };
    const result = toRawSql(testQuery);
    expect(result).toEqual(expected);
  });
});

import { QueryEditorExpressionType, SQLQuery } from '@grafana/sql';

import { toRawSql } from './sqlUtil';

describe('toRawSql', () => {
  it('should render sql properly', () => {
    const expected = 'SELECT "host" FROM "value1" WHERE "time" >= $__timeFrom AND "time" <= $__timeTo LIMIT 50';
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

  it('should wrap the identifiers with quote', () => {
    const expected = 'SELECT "host" FROM "TestValue" WHERE "time" >= $__timeFrom AND "time" <= $__timeTo LIMIT 50';
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
      table: 'TestValue',
    };
    const result = toRawSql(testQuery);
    expect(result).toEqual(expected);
  });

  it('should wrap filters in where', () => {
    const expected = `SELECT "host" FROM "TestValue" WHERE "time" >= $__timeFrom AND "time" <= $__timeTo AND ("sensor_id" = '12' AND "sensor_id" = '23') LIMIT 50`;
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
        whereString: `(sensor_id = '12' AND sensor_id = '23')`,
      },
      dataset: 'iox',
      table: 'TestValue',
    };
    const result = toRawSql(testQuery);
    expect(result).toEqual(expected);
  });
});

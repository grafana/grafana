import { QueryEditorExpressionType } from '../../expressions';
import {
  aggregationvariable,
  labelsVariable,
  metricVariable,
  namespaceVariable,
  setupMockedTemplateService,
} from '../../mocks/CloudWatchDataSource';
import {
  createFunctionWithParameter,
  createArray,
  createOperator,
  createGroupBy,
  createFunction,
  createProperty,
} from '../../mocks/sqlUtils';
import { SQLExpression } from '../../types';

import SQLGenerator from './SQLGenerator';

describe('SQLGenerator', () => {
  let baseQuery: SQLExpression = {
    select: createFunctionWithParameter('SUM', ['CPUUtilization']),
    from: createFunctionWithParameter('SCHEMA', ['AWS/EC2']),
    orderByDirection: 'DESC',
  };
  let mockTemplateSrv = setupMockedTemplateService();

  describe('mandatory fields check', () => {
    it('should return undefined if metric and aggregation is missing', () => {
      expect(
        new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({
          from: createFunctionWithParameter('SCHEMA', ['AWS/EC2']),
        })
      ).toBeUndefined();
    });

    it('should return undefined if aggregation is missing', () => {
      expect(
        new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({
          from: createFunctionWithParameter('SCHEMA', []),
        })
      ).toBeUndefined();
    });
  });

  it('should return query if mandatory fields are provided', () => {
    expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery(baseQuery)).not.toBeUndefined();
  });

  describe('select', () => {
    it('should use statistic and metric name', () => {
      const select = createFunctionWithParameter('COUNT', ['BytesPerSecond']);
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, select })).toEqual(
        `SELECT COUNT(BytesPerSecond) FROM SCHEMA("AWS/EC2")`
      );
    });

    it('should wrap in double quotes if metric name contains illegal characters ', () => {
      const select = createFunctionWithParameter('COUNT', ['Bytes-Per-Second']);
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, select })).toEqual(
        `SELECT COUNT("Bytes-Per-Second") FROM SCHEMA("AWS/EC2")`
      );
    });

    it('should wrap in double quotes if metric name starts with a number ', () => {
      const select = createFunctionWithParameter('COUNT', ['4xxErrorRate']);
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, select })).toEqual(
        `SELECT COUNT("4xxErrorRate") FROM SCHEMA("AWS/EC2")`
      );
    });

    it('should wrap in double quotes if metric name is a reserved keyword ', () => {
      const select = createFunctionWithParameter('SUM', ['Count']);
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, select })).toEqual(
        `SELECT SUM("Count") FROM SCHEMA("AWS/EC2")`
      );
    });
  });

  describe('from', () => {
    describe('with schema contraint', () => {
      it('should handle schema without dimensions', () => {
        const from = createFunctionWithParameter('SCHEMA', ['AWS/MQ']);
        expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, from })).toEqual(
          `SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/MQ")`
        );
      });

      it('should handle schema with dimensions', () => {
        const from = createFunctionWithParameter('SCHEMA', ['AWS/MQ', 'InstanceId', 'InstanceType']);
        expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, from })).toEqual(
          `SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/MQ", InstanceId, InstanceType)`
        );
      });

      it('should handle schema with dimensions that has special characters', () => {
        const from = createFunctionWithParameter('SCHEMA', [
          'AWS/MQ',
          'Instance Id',
          'Instance.Type',
          'Instance-Group',
        ]);
        expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, from })).toEqual(
          `SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/MQ", "Instance Id", "Instance.Type", "Instance-Group")`
        );
      });
    });

    describe('without schema', () => {
      it('should use the specified namespace', () => {
        const from = createProperty('AWS/MQ');
        expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, from })).toEqual(
          `SELECT SUM(CPUUtilization) FROM "AWS/MQ"`
        );
      });
    });
  });

  function assertQueryEndsWith(args: { sql: Partial<SQLExpression>; accountId?: string }, expectedFilter: string) {
    expect(
      new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, ...args.sql }, args.accountId)
    ).toEqual(`SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/EC2") ${expectedFilter}`);
  }
  describe('accountId', () => {
    it('should add where clause if account ID is defined', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery }, '12345')).toEqual(
        'SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/EC2") WHERE AWS.AccountId = \'12345\''
      );
    });

    it('should not add where clause if account ID is not defined', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery })).toEqual(
        'SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/EC2")'
      );
    });

    it('should not add where clause if account ID is all', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery })).toEqual(
        'SELECT SUM(CPUUtilization) FROM SCHEMA("AWS/EC2")'
      );
    });
  });
  describe('filter', () => {
    it('should not add WHERE clause in case its empty', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery })).not.toContain('WHERE');
    });

    it('should not add WHERE clause when there is no filter conditions', () => {
      const where = createArray([]);
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, where })).not.toContain('WHERE');
    });

    it('should add where clauses with AND if accountID is defined', () => {
      const where = createArray([createOperator('Instance-Id', '=', 'I-123')]);
      assertQueryEndsWith(
        { sql: { where }, accountId: '12345' },
        `WHERE AWS.AccountId = '12345' AND "Instance-Id" = 'I-123'`
      );
    });
    it('should add where clauses with WHERE if accountID is not defined', () => {
      const where = createArray([createOperator('Instance-Id', '=', 'I-123')]);
      assertQueryEndsWith({ sql: { where } }, `WHERE "Instance-Id" = 'I-123'`);
    });
    it('should add where clauses with WHERE if accountID is all', () => {
      const where = createArray([createOperator('Instance-Id', '=', 'I-123')]);
      assertQueryEndsWith({ sql: { where }, accountId: 'all' }, `WHERE "Instance-Id" = 'I-123'`);
    });
    // TODO: We should handle this scenario
    it.skip('should not add WHERE clause when the operator is incomplete', () => {
      const where = createArray([createOperator('Instance-Id', '=')]);
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery, where })).not.toContain('WHERE');
    });

    it('should handle one top level filter with AND', () => {
      const where = createArray([createOperator('Instance-Id', '=', 'I-123')]);
      assertQueryEndsWith({ sql: { where } }, `WHERE "Instance-Id" = 'I-123'`);
    });

    it('should handle one top level filter with OR', () => {
      assertQueryEndsWith(
        { sql: { where: createArray([createOperator('InstanceId', '=', 'I-123')]) } },
        `WHERE InstanceId = 'I-123'`
      );
    });

    it('should handle multiple top level filters combined with AND', () => {
      const filter = createArray(
        [createOperator('InstanceId', '=', 'I-123'), createOperator('Instance-Id', '!=', 'I-456')],
        QueryEditorExpressionType.And
      );
      assertQueryEndsWith({ sql: { where: filter } }, `WHERE InstanceId = 'I-123' AND "Instance-Id" != 'I-456'`);
    });

    it('should handle multiple top level filters combined with OR', () => {
      const filter = createArray(
        [createOperator('InstanceId', '=', 'I-123'), createOperator('InstanceId', '!=', 'I-456')],
        QueryEditorExpressionType.Or
      );
      assertQueryEndsWith({ sql: { where: filter } }, `WHERE InstanceId = 'I-123' OR InstanceId != 'I-456'`);
    });

    it('should handle one top level filters with one nested filter', () => {
      const filter = createArray(
        [
          createOperator('InstanceId', '=', 'I-123'),
          createArray([createOperator('InstanceId', '!=', 'I-456')], QueryEditorExpressionType.And),
        ],
        QueryEditorExpressionType.And
      );
      assertQueryEndsWith({ sql: { where: filter } }, `WHERE InstanceId = 'I-123' AND InstanceId != 'I-456'`);
    });

    it('should handle one top level filter with two nested filters combined with AND', () => {
      const filter = createArray(
        [
          createOperator('Instance.Type', '=', 'I-123'),
          createArray(
            [createOperator('InstanceId', '!=', 'I-456'), createOperator('Type', '!=', 'some-type')],
            QueryEditorExpressionType.And
          ),
        ],
        QueryEditorExpressionType.And
      );
      // In this scenario, the parenthesis are redundant. However, they're not doing any harm and it would be really complicated to remove them
      assertQueryEndsWith(
        { sql: { where: filter } },
        `WHERE "Instance.Type" = 'I-123' AND (InstanceId != 'I-456' AND "Type" != 'some-type')`
      );
    });

    it('should handle one top level filter with two nested filters combined with OR', () => {
      const filter = createArray(
        [
          createOperator('InstanceId', '=', 'I-123'),
          createArray(
            [createOperator('InstanceId', '!=', 'I-456'), createOperator('Type', '!=', 'some-type')],
            QueryEditorExpressionType.Or
          ),
        ],
        QueryEditorExpressionType.And
      );
      assertQueryEndsWith(
        { sql: { where: filter } },
        `WHERE InstanceId = 'I-123' AND (InstanceId != 'I-456' OR "Type" != 'some-type')`
      );
    });

    it('should handle two top level filters with two nested filters combined with AND', () => {
      const filter = createArray(
        [
          createArray(
            [createOperator('InstanceId', '=', 'I-123'), createOperator('Type', '!=', 'some-type')],
            QueryEditorExpressionType.And
          ),
          createArray(
            [createOperator('InstanceId', '!=', 'I-456'), createOperator('Type', '!=', 'some-type')],
            QueryEditorExpressionType.Or
          ),
        ],
        QueryEditorExpressionType.And
      );

      assertQueryEndsWith(
        { sql: { where: filter } },
        `WHERE (InstanceId = 'I-123' AND "Type" != 'some-type') AND (InstanceId != 'I-456' OR "Type" != 'some-type')`
      );
    });

    it('should handle two top level filters with two nested filters combined with OR', () => {
      const filter = createArray(
        [
          createArray(
            [createOperator('InstanceId', '=', 'I-123'), createOperator('Type', '!=', 'some-type')],
            QueryEditorExpressionType.Or
          ),
          createArray(
            [createOperator('InstanceId', '!=', 'I-456'), createOperator('Type', '!=', 'some-type')],
            QueryEditorExpressionType.Or
          ),
        ],
        QueryEditorExpressionType.Or
      );
      assertQueryEndsWith(
        { sql: { where: filter } },
        `WHERE (InstanceId = 'I-123' OR "Type" != 'some-type') OR (InstanceId != 'I-456' OR "Type" != 'some-type')`
      );
    });

    it('should handle three top level filters with one nested filters combined with OR', () => {
      const filter = createArray(
        [
          createArray([createOperator('InstanceId', '=', 'I-123')], QueryEditorExpressionType.Or),
          createArray([createOperator('Type', '!=', 'some-type')], QueryEditorExpressionType.Or),
          createArray([createOperator('InstanceId', '!=', 'I-456')], QueryEditorExpressionType.Or),
        ],
        QueryEditorExpressionType.Or
      );
      assertQueryEndsWith(
        { sql: { where: filter } },
        `WHERE InstanceId = 'I-123' OR "Type" != 'some-type' OR InstanceId != 'I-456'`
      );
    });

    it('should handle three top level filters with one nested filters combined with AND', () => {
      const filter = createArray(
        [
          createArray([createOperator('InstanceId', '=', 'I-123')], QueryEditorExpressionType.Or),
          createArray([createOperator('Type', '!=', 'some-type')], QueryEditorExpressionType.Or),
          createArray([createOperator('InstanceId', '!=', 'I-456')], QueryEditorExpressionType.Or),
        ],
        QueryEditorExpressionType.And
      );
      assertQueryEndsWith(
        { sql: { where: filter } },
        `WHERE InstanceId = 'I-123' AND "Type" != 'some-type' AND InstanceId != 'I-456'`
      );
    });
  });

  describe('group by', () => {
    it('should not add GROUP BY clause in case its empty', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery })).not.toContain('GROUP BY');
    });
    it('should handle single label', () => {
      const groupBy = createArray([createGroupBy('InstanceId')], QueryEditorExpressionType.And);
      assertQueryEndsWith({ sql: { groupBy } }, `GROUP BY InstanceId`);
    });
    it('should handle multiple label', () => {
      const groupBy = createArray(
        [createGroupBy('InstanceId'), createGroupBy('Type'), createGroupBy('Group')],
        QueryEditorExpressionType.And
      );
      assertQueryEndsWith({ sql: { groupBy } }, `GROUP BY InstanceId, "Type", "Group"`);
    });
  });

  describe('order by', () => {
    it('should not add ORDER BY clause in case its empty', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery })).not.toContain('ORDER BY');
    });
    it('should handle SUM ASC', () => {
      const orderBy = createFunction('SUM');
      assertQueryEndsWith({ sql: { orderBy, orderByDirection: 'ASC' } }, `ORDER BY SUM() ASC`);
    });

    it('should handle SUM ASC', () => {
      const orderBy = createFunction('SUM');
      assertQueryEndsWith({ sql: { orderBy, orderByDirection: 'ASC' } }, `ORDER BY SUM() ASC`);
    });
    it('should handle COUNT DESC', () => {
      const orderBy = createFunction('COUNT');
      assertQueryEndsWith({ sql: { orderBy, orderByDirection: 'DESC' } }, `ORDER BY COUNT() DESC`);
    });
  });
  describe('limit', () => {
    it('should not add LIMIT clause in case its empty', () => {
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery({ ...baseQuery })).not.toContain('LIMIT');
    });

    it('should be added in case its specified', () => {
      assertQueryEndsWith({ sql: { limit: 10 } }, `LIMIT 10`);
    });
  });

  describe('full query', () => {
    it('should not add LIMIT clause in case its empty', () => {
      let query: SQLExpression = {
        select: createFunctionWithParameter('COUNT', ['DroppedBytes']),
        from: createFunctionWithParameter('SCHEMA', ['AWS/MQ', 'InstanceId', 'Instance-Group']),
        where: createArray(
          [
            createArray(
              [createOperator('InstanceId', '=', 'I-123'), createOperator('Type', '!=', 'some-type')],
              QueryEditorExpressionType.Or
            ),
            createArray(
              [createOperator('InstanceId', '!=', 'I-456'), createOperator('Type', '!=', 'some-type')],
              QueryEditorExpressionType.Or
            ),
          ],
          QueryEditorExpressionType.And
        ),
        groupBy: createArray([createGroupBy('InstanceId'), createGroupBy('InstanceType')]),
        orderBy: createFunction('COUNT'),
        orderByDirection: 'DESC',
        limit: 100,
      };
      expect(new SQLGenerator(mockTemplateSrv).expressionToSqlQuery(query)).toEqual(
        `SELECT COUNT(DroppedBytes) FROM SCHEMA("AWS/MQ", InstanceId, "Instance-Group") WHERE (InstanceId = 'I-123' OR "Type" != 'some-type') AND (InstanceId != 'I-456' OR "Type" != 'some-type') GROUP BY InstanceId, InstanceType ORDER BY COUNT() DESC LIMIT 100`
      );
    });
  });

  describe('using variables', () => {
    const templateService = setupMockedTemplateService([
      metricVariable,
      namespaceVariable,
      labelsVariable,
      aggregationvariable,
    ]);

    it('should interpolate variables correctly', () => {
      let query: SQLExpression = {
        select: createFunctionWithParameter('$aggregation', ['$metric']),
        from: createFunctionWithParameter('SCHEMA', ['$namespace', '$labels']),
        where: createArray(
          [
            createArray(
              [createOperator('InstanceId', '=', 'I-123'), createOperator('Type', '!=', 'some-type')],
              QueryEditorExpressionType.Or
            ),
            createArray(
              [createOperator('InstanceId', '!=', 'I-456'), createOperator('Type', '!=', 'some-type')],
              QueryEditorExpressionType.Or
            ),
          ],
          QueryEditorExpressionType.And
        ),
        groupBy: createArray([createGroupBy('$labels')]),
        orderBy: createFunction('$aggregation'),
        orderByDirection: 'DESC',
        limit: 100,
      };
      expect(new SQLGenerator(templateService).expressionToSqlQuery(query)).toEqual(
        `SELECT $aggregation($metric) FROM SCHEMA(\"$namespace\", $labels) WHERE (InstanceId = 'I-123' OR "Type" != 'some-type') AND (InstanceId != 'I-456' OR "Type" != 'some-type') GROUP BY $labels ORDER BY $aggregation() DESC LIMIT 100`
      );
    });
  });
});

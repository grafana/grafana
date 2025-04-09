import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { Graph } from 'app/core/utils/dag';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import {
  DAGError,
  _getDescendants,
  _getOriginsOfRefId,
  createDagFromQueries,
  fingerprintGraph,
  getTargets,
  parseRefsFromMathExpression,
  parseRefsFromSqlExpression,
} from './dag';

describe('working with dag', () => {
  test('with data query and expressions', () => {
    const queries = [
      {
        refId: 'A',
        model: {
          refId: 'A',
          expression: '',
        },
      },
      {
        refId: 'B',
        model: {
          refId: 'B',
          expression: 'A',
        },
      },
      {
        refId: 'C',
        model: {
          refId: 'C',
          expression: '$B > 0',
          type: 'math',
        },
      },
      {
        refId: 'D',
        model: {
          refId: 'D',
          expression: 'B',
          type: 'threshold',
        },
      },
    ] as AlertQuery[];

    const dag = createDagFromQueries(queries);

    expect(Object.keys(dag.nodes)).toHaveLength(4);

    expect(() => {
      dag.getNode('A');
      dag.getNode('B');
      dag.getNode('C');
      dag.getNode('D');
    }).not.toThrow();

    expect(dag.getNode('A')!.inputEdges).toHaveLength(0);
    expect(dag.getNode('A')!.outputEdges).toHaveLength(0);

    expect(dag.getNode('B')!.inputEdges).toHaveLength(0);
    expect(dag.getNode('B')!.outputEdges).toHaveLength(2);
    expect(dag.getNode('B')!.outputEdges[0].outputNode).toHaveProperty('name', 'C');
    expect(dag.getNode('B')!.outputEdges[1].outputNode).toHaveProperty('name', 'D');

    expect(dag.getNode('C')!.inputEdges).toHaveLength(1);
    expect(dag.getNode('C')!.inputEdges[0].inputNode).toHaveProperty('name', 'B');
    expect(dag.getNode('C')!.outputEdges).toHaveLength(0);

    expect(dag.getNode('D')!.inputEdges).toHaveLength(1);
    expect(dag.getNode('D')!.inputEdges[0].inputNode).toHaveProperty('name', 'B');
    expect(dag.getNode('D')!.outputEdges).toHaveLength(0);
  });

  test('data queries cannot have references', () => {
    const queries = [
      {
        refId: 'A',
        model: {
          refId: 'A',
          expression: 'vector(1)',
        },
      },
    ] as AlertQuery[];

    expect(() => createDagFromQueries(queries)).not.toThrow();

    const dag = createDagFromQueries(queries);

    expect(Object.keys(dag.nodes)).toHaveLength(1);

    expect(() => {
      dag.getNode('A');
    }).not.toThrow();
  });

  it('should throw on references to self', () => {
    const queries: Array<AlertQuery<ExpressionQuery>> = [
      {
        refId: 'A',
        model: { refId: 'A', expression: '$A', datasource: ExpressionDatasourceRef, type: ExpressionQueryType.math },
        queryType: '',
        datasourceUid: '__expr__',
      },
    ];

    expect(() => createDagFromQueries(queries)).toThrowError(/failed to create DAG from queries/i);

    // now assert we get the correct error diagnostics
    try {
      createDagFromQueries(queries);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      expect(error instanceof DAGError).toBe(true);
      expect(error!.cause).toMatchSnapshot();
    }
  });
});

describe('getOriginsOfRefId', () => {
  test('with multiple sources', () => {
    const graph = new Graph();
    graph.createNodes(['A', 'B', 'C', 'D']);
    graph.link('A', 'B');
    graph.link('B', 'C');
    graph.link('D', 'B');

    expect(_getOriginsOfRefId('C', graph)).toEqual(['A', 'D']);
  });

  test('with single source', () => {
    const graph = new Graph();
    graph.createNodes(['A', 'B', 'C', 'D']);
    graph.link('A', 'B');
    graph.link('B', 'C');
    graph.link('B', 'D');

    expect(_getOriginsOfRefId('C', graph)).toEqual(['A']);
    expect(_getOriginsOfRefId('D', graph)).toEqual(['A']);
  });
});

describe('getDescendants', () => {
  test('with multiple generations', () => {
    const graph = new Graph();
    graph.createNodes(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    graph.link('A', 'B');
    graph.link('B', 'G');
    graph.link('A', 'C');
    graph.link('C', 'D');
    graph.link('E', 'F');

    expect(_getDescendants('A', graph)).toEqual(['B', 'G', 'C', 'D']);
  });
});

describe('parseRefsFromMathExpression', () => {
  const cases: Array<[string, string[]]> = [
    ['$A', ['A']],
    ['$A > $B', ['A', 'B']],
    ['$FOO123 > $BAR123', ['FOO123', 'BAR123']],
    ['${FOO BAR} > 0', ['FOO BAR']],
    ['$A\n || \n $B', ['A', 'B']],
  ];

  test.each(cases)('testing "%s"', (input, output) => {
    expect(parseRefsFromMathExpression(input)).toEqual(output);
  });
});

describe('parseRefsFromSqlExpression', () => {
  describe('basic FROM queries', () => {
    it('should extract table from simple SELECT', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM table1')).toEqual(['table1']);
    });

    it('ignores comments that might contain "from"', () => {
      expect(
        parseRefsFromSqlExpression(`
-- a from b
/** foo from bar */
/**
 joe from bloggs
 */
SELECT * FROM table1`)
      ).toEqual(['table1']);
    });

    it('should be case insensitive for SQL keywords', () => {
      expect(parseRefsFromSqlExpression('select * from table1')).toEqual(['table1']);
    });

    it('should work with specific field selections', () => {
      expect(parseRefsFromSqlExpression('SELECT field1, field2 FROM table1')).toEqual(['table1']);
    });

    it('should preserve the original case of table names', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM TableName')).toEqual(['TableName']);
      expect(parseRefsFromSqlExpression('SELECT * FROM tablename')).toEqual(['tablename']);
      expect(parseRefsFromSqlExpression('SELECT * FROM TABLENAME')).toEqual(['TABLENAME']);
      expect(parseRefsFromSqlExpression('SELECT * FROM Table_Name')).toEqual(['Table_Name']);
    });
  });

  describe('multiple tables in FROM clause', () => {
    it('should extract multiple comma-separated tables with spaces', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM table1, table2')).toEqual(['table1', 'table2']);
    });

    it('should extract multiple comma-separated tables without spaces', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM table1,table2')).toEqual(['table1', 'table2']);
    });
  });

  describe('JOIN queries', () => {
    it('should extract tables from basic JOIN', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM table1 JOIN table2 ON table1.id = table2.id')).toEqual([
        'table1',
        'table2',
      ]);
    });

    it('should extract tables from INNER JOIN', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM table1 INNER JOIN table2 ON table1.id = table2.id')).toEqual([
        'table1',
        'table2',
      ]);
    });

    it('should extract tables from LEFT JOIN', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM table1 LEFT JOIN table2 ON table1.id = table2.id')).toEqual([
        'table1',
        'table2',
      ]);
    });
  });

  describe('tables with aliases', () => {
    it('should extract table name when using AS keyword', () => {
      expect(parseRefsFromSqlExpression('SELECT t.* FROM table1 AS t')).toEqual(['table1']);
    });

    it('should extract table name when using implicit alias', () => {
      expect(parseRefsFromSqlExpression('SELECT t.* FROM table1 t')).toEqual(['table1']);
    });
  });

  describe('schema qualified tables', () => {
    it('should extract table name from schema.table format', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM schema.table1')).toEqual(['table1']);
    });

    it('should extract table name from quoted identifiers', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM "schema"."table1"')).toEqual(['table1']);
    });
  });

  describe('complex queries', () => {
    it('should extract all tables from a complex query with joins and aliases', () => {
      const complexQuery = `
        SELECT t1.field1, t2.field2
        FROM schema1.table1 AS t1
        JOIN schema2.table2 t2 ON t1.id = t2.id
        LEFT JOIN table3 ON t2.id = table3.id
      `;
      expect(parseRefsFromSqlExpression(complexQuery)).toEqual(['table1', 'table2', 'table3']);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      expect(parseRefsFromSqlExpression('')).toEqual([]);
    });

    it('should return empty array for null input', () => {
      expect(parseRefsFromSqlExpression(null as unknown as string)).toEqual([]);
    });

    it('should handle unusual spacing', () => {
      expect(parseRefsFromSqlExpression('SELECT    *   FROM    table1')).toEqual(['table1']);
    });

    it('should handle line breaks', () => {
      expect(parseRefsFromSqlExpression('SELECT * FROM\ntable1')).toEqual(['table1']);
    });
  });
});

describe('fingerprints', () => {
  test('DAG fingerprint', () => {
    const graph = new Graph();
    graph.createNodes(['A', 'B', 'C', 'D']);
    graph.link('A', 'B');
    graph.link('B', 'C');
    graph.link('D', 'B');

    expect(fingerprintGraph(graph)).toMatchInlineSnapshot(`"A:B: B:C:A, D C::B D:B:"`);
  });
});

describe('getTargets', () => {
  it('should correct get targets from Math expression', () => {
    const expression: ExpressionQuery = {
      refId: 'C',
      type: ExpressionQueryType.math,
      datasource: ExpressionDatasourceRef,
      expression: '$A + $B',
    };

    expect(getTargets(expression)).toEqual(['A', 'B']);
  });

  it('should be able to find the targets of a classic condition', () => {
    const expression: ExpressionQuery = {
      refId: 'C',
      type: ExpressionQueryType.classic,
      datasource: ExpressionDatasourceRef,
      expression: '',
      conditions: [
        {
          evaluator: {
            params: [0, 0],
            type: EvalFunction.IsAbove,
          },
          operator: { type: 'and' },
          query: { params: ['A'] },
          reducer: { params: [], type: 'avg' },
          type: 'query',
        },
        {
          evaluator: {
            params: [0, 0],
            type: EvalFunction.IsAbove,
          },
          operator: { type: 'and' },
          query: { params: ['B'] },
          reducer: { params: [], type: 'avg' },
          type: 'query',
        },
      ],
    };

    expect(getTargets(expression)).toEqual(['A', 'B']);
  });

  it('should work for any other expression type', () => {
    const expression: ExpressionQuery = {
      refId: 'C',
      type: ExpressionQueryType.reduce,
      datasource: ExpressionDatasourceRef,
      expression: 'A',
    };

    expect(getTargets(expression)).toEqual(['A']);
  });
});

import { Graph } from 'app/core/utils/dag';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import {
  _getOriginsOfRefId,
  parseRefsFromMathExpression,
  _createDagFromQueries,
  fingerprintGraph,
  fingerPrintQueries,
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
    ] as AlertQuery[];

    const dag = _createDagFromQueries(queries);

    expect(Object.keys(dag.nodes)).toHaveLength(3);

    expect(() => {
      dag.getNode('A');
      dag.getNode('B');
      dag.getNode('C');
    }).not.toThrow();

    expect(dag.getNode('A').inputEdges).toHaveLength(0);
    expect(dag.getNode('A').outputEdges).toHaveLength(1);
    expect(dag.getNode('A').outputEdges[0].outputNode).toHaveProperty('name', 'B');

    expect(dag.getNode('B').inputEdges).toHaveLength(1);
    expect(dag.getNode('B').outputEdges).toHaveLength(1);
    expect(dag.getNode('B').inputEdges[0].inputNode).toHaveProperty('name', 'A');
    expect(dag.getNode('B').outputEdges[0].outputNode).toHaveProperty('name', 'C');

    expect(dag.getNode('C').inputEdges).toHaveLength(1);
    expect(dag.getNode('C').outputEdges).toHaveLength(0);
    expect(dag.getNode('C').inputEdges[0].inputNode).toHaveProperty('name', 'B');
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

describe('fingerprints', () => {
  test('DAG fingerprint', () => {
    const graph = new Graph();
    graph.createNodes(['A', 'B', 'C', 'D']);
    graph.link('A', 'B');
    graph.link('B', 'C');
    graph.link('D', 'B');

    expect(fingerprintGraph(graph)).toMatchInlineSnapshot(`"A:B: B:C:A, D C::B D:B:"`);
  });

  test('Queries fingerprint', () => {
    const queries = [
      {
        refId: 'A',
        queryType: 'query',
        model: {
          refId: 'A',
          expression: '',
        },
      },
      {
        refId: 'B',
        queryType: 'query',
        model: {
          refId: 'B',
          expression: 'A',
        },
      },
      {
        refId: 'C',
        queryType: 'query',
        model: {
          refId: 'C',
          expression: '$B > 0',
          type: 'math',
        },
      },
    ] as AlertQuery[];

    expect(fingerPrintQueries(queries)).toMatchInlineSnapshot(`"Aquery,BAquery,C$B > 0math"`);
  });
});

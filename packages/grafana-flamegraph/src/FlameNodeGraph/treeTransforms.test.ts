import { textToDataContainer } from '../FlameGraph/testHelpers';

import { treeToGraph } from './treeTransforms';
import { GraphEdges, GraphNode, GraphNodes } from './types';

describe('treeTransforms', () => {
  it('ignores root item', () => {
    const container = textToDataContainer(`
    [0//////////]
    [1//][2///]
    `)!;
    const { nodes, edges } = treeToGraph(container.getLevels()[0][0]);
    expect(nodes).toMatchObject({
      1: { label: '1', self: 5, value: 5, parents: [], children: [] },
      2: { label: '2', self: 6, value: 6, parents: [], children: [] },
    });
    expect(edges).toEqual({});
  });

  it('creates nodes and edges in small flamegraph', () => {
    const container = textToDataContainer(`
    [0////////////]
    [1//][2///][3/]
         [4///][5]
         [6]
    `)!;
    const { nodes, edges } = treeToGraph(container.getLevels()[0][0]);
    expect(nodesToStringObject(nodes)).toEqual({
      1: '5/5|p:|c:',
      2: '0/6|p:|c:4',
      3: '1/4|p:|c:5',
      4: '3/6|p:2|c:6',
      5: '3/3|p:3|c:',
      6: '3/3|p:4|c:',
    });
    expect(edgesToString(edges)).toEqual(['2-4', '3-5', '4-6']);
  });

  it('creates nodes and edges tall flamegraph', () => {
    const container = textToDataContainer(`
    [0]
    [1]
    [2]
    [3]
    [4]
    [5]
    [6]
    `)!;
    const { nodes, edges } = treeToGraph(container.getLevels()[0][0]);
    expect(nodesToStringObject(nodes)).toEqual({
      1: '0/3|p:|c:2',
      2: '0/3|p:1|c:3',
      3: '0/3|p:2|c:4',
      4: '0/3|p:3|c:5',
      5: '0/3|p:4|c:6',
      6: '3/3|p:5|c:',
    });
    expect(edgesToString(edges)).toEqual(['1-2', '2-3', '3-4', '4-5', '5-6']);
  });
});

function nodesToStringObject(nodes: GraphNodes) {
  const nodesString: Record<string, string> = {};
  for (const key of Object.keys(nodes)) {
    if (key !== nodes[key].label) {
      throw new Error(`key ${key} does not match label ${nodes[key].label}`);
    }
    nodesString[key] = nodeToString(nodes[key]);
  }
  return nodesString;
}

function nodeToString(node: GraphNode) {
  return `${node.self}/${node.value}|p:${node.parents.map((n) => n.from.label).join(',')}|c:${node.children.map((n) => n.to.label).join(',')}`;
}

// Returns edges as a sorted array of strings in the format ['from-to', *]
export function edgesToString(edges: GraphEdges) {
  return Object.keys(edges)
    .map((key) => {
      if (key !== `${edges[key].from.label}-${edges[key].to.label}`) {
        throw new Error(`key ${key} does not match node labels ${edges[key].from.label} and ${edges[key].to.label}`);
      }
      return key;
    })
    .sort();
}

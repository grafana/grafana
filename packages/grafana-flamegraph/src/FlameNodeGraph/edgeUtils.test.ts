import { textToDataContainer } from '../FlameGraph/testHelpers';

import { createResidualEdges, removeRedundantEdges } from './edgeUtils';
import { edgesToString } from './treeTransforms.test';
import { GraphEdges, GraphNode, GraphNodes } from './types';

describe('createResidualEdges', () => {
  it('doesnt create new edge if nothing was deleted', () => {
    const { root, nodes, edges } = getDefaultGraph();
    const newEdges = createResidualEdges(root, nodes, edges);
    expect(newEdges).toEqual(edges);
  });

  it('doesnt create new edge if its not needed', () => {
    const { root, nodes, edges } = getDefaultGraph();
    delete nodes['1'];

    const newEdges = createResidualEdges(root, nodes, edges);
    expect(newEdges).toEqual(edges);
  });

  it('creates residual edge if we remove middle node', () => {
    const { root, nodes, edges } = getDefaultGraph();
    delete nodes['4'];

    const newEdges = createResidualEdges(root, nodes, edges);
    expect(edgesToString(newEdges)).toEqual(['1-3', '2-4', '2-5', '4-5']);
    expect(newEdges['2-5']).toMatchObject({ residual: true });
  });
});

describe('removeRedundantEdges', () => {
  it('it should remove redundant edges', () => {
    // At the start we have graph like this:
    //  0   1
    //  |\ /
    //  2 3
    //  \ |
    //   4

    const allSortedNodes: GraphNode[] = [
      { label: '0', self: 5, value: 5, parents: [], children: [] },
      { label: '1', self: 6, value: 6, parents: [], children: [] },
      { label: '2', self: 3, value: 3, parents: [], children: [] },
      { label: '3', self: 6, value: 6, parents: [], children: [] },
      { label: '4', self: 3, value: 3, parents: [], children: [] },
    ];

    const edges: GraphEdges = {
      '0-2': { from: allSortedNodes[0], to: allSortedNodes[2], weight: 1, residual: false },
      '0-3': { from: allSortedNodes[0], to: allSortedNodes[3], weight: 1, residual: false },
      '1-3': { from: allSortedNodes[1], to: allSortedNodes[3], weight: 1, residual: false },
      '2-4': { from: allSortedNodes[2], to: allSortedNodes[4], weight: 1, residual: false },
      '3-4': { from: allSortedNodes[3], to: allSortedNodes[4], weight: 1, residual: false },
    };

    allSortedNodes[0].children.push(edges['0-2'], edges['0-3']);
    allSortedNodes[1].children.push(edges['1-3']);
    allSortedNodes[2].parents.push(edges['0-2']);
    allSortedNodes[2].children.push(edges['2-4']);
    allSortedNodes[3].parents.push(edges['0-3'], edges['1-3']);
    allSortedNodes[3].children.push(edges['3-4']);
    allSortedNodes[4].parents.push(edges['2-4'], edges['3-4']);

    // By trimming we removed 3:
    //  0   1
    //  |\ /
    //  2 x
    //  \ |
    //   4

    const keptNodes: GraphNodes = {
      0: allSortedNodes[0],
      1: allSortedNodes[1],
      2: allSortedNodes[2],
      4: allSortedNodes[4],
    };

    // This should then create residual edges:
    //  0   1
    //  |\  |
    //  2 | |
    //  \ | /
    //   \|/
    //    4
    // Where 0-4 is redundant while 1-4 is kept. We should also remove any edge referencing the removed 3 node.
    edges['0-4'] = { from: allSortedNodes[0], to: allSortedNodes[4], weight: 1, residual: true };
    edges['1-4'] = { from: allSortedNodes[1], to: allSortedNodes[4], weight: 1, residual: true };

    allSortedNodes[4].parents.push(edges['0-4'], edges['1-4']);

    const newEdges = removeRedundantEdges(allSortedNodes, keptNodes, edges, 0);
    expect(edgesToString(newEdges)).toEqual(['0-2', '1-4', '2-4']);
  });
});

function getDefaultGraph() {
  const container = textToDataContainer(`
    [0//////////]
    [1//][2///]
    [3]  [4///]
         [5//]
    `)!;

  const nodes: GraphNodes = {
    1: { label: '1', self: 0, value: 5, parents: [], children: [] },
    2: { label: '2', self: 0, value: 6, parents: [], children: [] },
    3: { label: '3', self: 3, value: 3, parents: [], children: [] },
    4: { label: '4', self: 1, value: 6, parents: [], children: [] },
    5: { label: '5', self: 5, value: 5, parents: [], children: [] },
  };

  const edges: GraphEdges = {
    '1-3': { from: nodes[1], to: nodes[3], weight: 1, residual: false },
    '2-4': { from: nodes[2], to: nodes[4], weight: 1, residual: false },
    '4-5': { from: nodes[4], to: nodes[5], weight: 1, residual: false },
  };

  nodes['1'].children.push(edges['1-3']);
  nodes['3'].parents.push(edges['1-3']);
  nodes['2'].children.push(edges['2-4']);
  nodes['4'].parents.push(edges['2-4']);
  nodes['4'].children.push(edges['4-5']);
  nodes['5'].parents.push(edges['4-5']);

  return { root: container.getLevels()[0][0], nodes, edges };
}

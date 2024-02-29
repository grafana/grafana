import { LevelItem } from '../FlameGraph/dataTransform';

import { createResidualEdges, edgeEntropyScore, removeRedundantEdges } from './edgeUtils';
import { GraphNodes, GraphEdges, GraphNode } from './types';

export function calcMaxAndSumValues(root: LevelItem) {
  let maxSelf = 0;
  let maxTotal = 0;
  let sumSelf = 0;
  let sumTotal = 0;

  // We are skipping root as we don't show it in the graph
  const stack = [...root.children];
  while (stack.length) {
    let currentNode = stack.pop()!;

    maxSelf = Math.max(maxSelf, currentNode.self);
    maxTotal = Math.max(maxTotal, currentNode.value);
    sumSelf += currentNode.self;
    sumTotal += currentNode.value;

    // Should not be important what is the traversal order here
    stack.push(...currentNode.children);
  }

  return { maxSelf, maxTotal, sumSelf, sumTotal };
}

type TrimOptions = {
  nodeCutoff: number;
  edgeCutoff: number;
  maxNodes: number;
};

export function trimGraphNodesAndEdges(
  root: LevelItem,
  nodesArg: GraphNodes,
  edgesArg: GraphEdges,
  options: TrimOptions
) {
  let nodes = { ...nodesArg };
  let edges = { ...edgesArg };

  // Remove nodes based on total (merged) value
  Object.keys(nodes).forEach((key) => {
    if (nodes[key].value < options.nodeCutoff) {
      delete nodes[key];
    }
  });

  const { keptNodes, sortedNodes } = trimNodesByEntropy(nodes, options.maxNodes);
  edges = createResidualEdges(root, keptNodes, edges);
  edges = removeRedundantEdges(sortedNodes, nodes, edges, options.edgeCutoff);
  return { edges, nodes: keptNodes };
}

// Sort nodes based on entropy score, label, self
function trimNodesByEntropy(nodes: GraphNodes, maxNodes: number) {
  const entropyScores = getEntropyScores(nodes);

  const nodesList = Object.values(nodes).sort((a, b) => {
    const sa: number = entropyScores[a.label];
    const sb: number = entropyScores[b.label];
    if (sa !== sb) {
      return sb - sa;
    }
    // TODO: don't think we should have 2 nodes with the same labels at this point.
    if (a.label !== b.label) {
      return a.label < b.label ? -1 : 1;
    }
    if (a.self !== b.self) {
      return sb - sa;
    }

    return a.label < b.label ? -1 : 1;
  });

  const keptNodes: GraphNodes = {};
  nodesList.slice(maxNodes).forEach((node) => {
    keptNodes[node.label] = node;
  });
  return { keptNodes, sortedNodes: nodesList };
}

// Not really sure what this entropy means and is mostly taken form pyroscope code
// see https://github.com/grafana/pyroscope/blob/ca855d2eb424590393d8c0086a1ffcd00f2bc88c/packages/pyroscope-flamegraph/src/convert/toGraphviz.ts#L319
function getEntropyScores(nodes: GraphNodes): { [key: string]: number } {
  const cachedScores: { [key: string]: number } = {};
  Object.keys(nodes).forEach((key) => {
    cachedScores[nodes[key].label] = entropyScore(nodes[key]);
  });
  return cachedScores;
}

function entropyScore(n: GraphNode): number {
  let score = 0;

  if (n.parents.length === 0) {
    score += 1;
  } else {
    score += edgeEntropyScore(n.parents, 0);
  }

  if (n.children.length === 0) {
    score += 1;
  } else {
    score += edgeEntropyScore(n.children, n.self);
  }

  return score * n.value + n.self;
}

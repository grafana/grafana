import { LevelItem } from '../FlameGraph/dataTransform';

import { GraphNodes, GraphEdges, GraphNode, GraphEdge, makeEdgeKey } from './treeTransforms';

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

function edgeEntropyScore(edges: GraphEdge[], self: number) {
  let score = 0;
  let total = self;
  edges.forEach((e) => {
    if (e.weight > 0) {
      total += Math.abs(e.weight);
    }
  });

  if (total !== 0) {
    edges.forEach((e) => {
      const frac = Math.abs(e.weight) / total;
      score += -frac * Math.log2(frac);
    });
    if (self > 0) {
      const frac = Math.abs(self) / total;
      score += -frac * Math.log2(frac);
    }
  }
  return score;
}

/**
 * Create residual edges. Residual means that we deleted a node or more between nodes we want to keep and so we need
 * to create edges between node and some of its grandparent to compensate for that. Because of that we need to look
 * at the original tree and compare that with the nodes we want to keep.
 * @param originalTree
 * @param nodes
 * @param edges
 */
function createResidualEdges(originalTree: LevelItem, nodes: GraphNodes, edges: GraphEdges) {
  const newEdges = { ...edges };
  const stack: Array<{ item: LevelItem; lastExistingParent?: LevelItem }> = [
    ...originalTree.children.map((i) => ({ item: i, lastExistingParent: undefined })),
  ];
  while (stack.length) {
    const args = stack.shift()!;
    const isDeleted = !nodes[args.item.label];
    stack.unshift(
      ...args.item.children.map((c) => ({
        item: c,
        lastExistingParent: isDeleted ? args.lastExistingParent : args.item,
      }))
    );

    if (
      !isDeleted &&
      args.lastExistingParent &&
      // Check if have a skip level edge to create or we just have kept the same parent.
      args.lastExistingParent.label !== args.item.parents?.[0].label
    ) {
      const edgeKey = makeEdgeKey(args.lastExistingParent.label, args.item.label);
      if (newEdges[edgeKey]) {
        newEdges[edgeKey].weight += args.item.value;
        newEdges[edgeKey].residual = true;
      } else {
        newEdges[edgeKey] = {
          from: nodes[args.lastExistingParent.label],
          to: nodes[args.item.label],
          weight: 0,
          residual: true,
        };
      }
    }
  }

  return newEdges;
}

// Not really sure here seems like redundant edges means that if have other means of getting from A - B like A - C - B
// then A - B is redundant?
function isRedundantEdge(edge: GraphEdge) {
  const seen: Record<string, boolean> = {};
  const queue = [edge.to];

  while (queue.length > 0) {
    const node = queue.shift()!;

    for (const parentEdge of node.parents) {
      if (!(edge === parentEdge || seen[parentEdge.from.label])) {
        if (parentEdge.from === edge.from) {
          return true;
        }
        seen[parentEdge.from.label] = true;
        queue.push(parentEdge.from);
      }
    }
  }
  return false;
}

/**
 * Remove edges that are residual and also deemed redundant by isRedundantEdge, and those which weight is less than cutoff.
 */
function removeRedundantEdges(
  sortedNodes: GraphNode[],
  graphNodes: GraphNodes,
  graphEdges: GraphEdges,
  weightCutoff: number
) {
  const edges = { ...graphEdges };
  sortedNodes.reverse().forEach((node) => {
    const sortedParentEdges = node.parents.sort((a, b) => b.weight - a.weight);
    for (const parentEdge of sortedParentEdges) {
      if (!parentEdge.residual) {
        break;
      }

      if (isRedundantEdge(parentEdge)) {
        delete edges[makeEdgeKey(parentEdge.from.label, parentEdge.to.label)];
      }
    }
  });

  // now we clean up edges
  for (const key of Object.keys(edges)) {
    const edge = edges[key];
    // first delete the ones that no longer have nodes
    if (!(graphNodes[edge.from.label] && graphNodes[edge.to.label])) {
      delete edges[key];
    }
    // second delete the ones that are too small
    if (edge.weight < weightCutoff) {
      delete edges[key];
    }
  }

  return edges;
}

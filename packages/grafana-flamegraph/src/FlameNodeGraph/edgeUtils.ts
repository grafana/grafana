import { LevelItem } from '../FlameGraph/dataTransform';

import { GraphEdge, GraphEdges, GraphNode, GraphNodes } from './types';

/**
 * Create residual edges. Residual means that we deleted a node or more between nodes we want to keep and so we need
 * to create edges between node and some of its grandparent to compensate for that. Because of that we need to look
 * at the original tree and compare that with the nodes we want to keep.
 * @param originalTree
 * @param nodes
 * @param edges
 */
export function createResidualEdges(originalTree: LevelItem, nodes: GraphNodes, edges: GraphEdges) {
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

function isRedundantEdge(edge: GraphEdge) {
  const seen: Record<string, boolean> = {};
  const queue = [edge.to];

  while (queue.length > 0) {
    const node = queue.shift()!;

    // loop over all edges that go into this node
    for (const parentEdge of node.parents) {
      if (edge === parentEdge || seen[parentEdge.from.label]) {
        // skip if we are looking at the same edge, or we have already seen this parent node
        continue;
      }

      if (parentEdge.from === edge.from) {
        // we found edge that has the same from the edge we are testing which means there is some other path between
        // the from and to node of the edge we are testing.
        return true;
      }
      seen[parentEdge.from.label] = true;
      queue.push(parentEdge.from);
    }
  }
  return false;
}

/**
 * Remove edges that are residual and also deemed redundant by isRedundantEdge, and those which weight is less than cutoff.
 * @param sortedAllNodes all nodes sorted by entropy
 * @param graphNodes nodes that we kept after trimming
 * @param graphEdges edges but with additional residual edges created after nodes were trimmed
 * @param weightCutoff edges with weight less than this will be removed
 */
export function removeRedundantEdges(
  sortedAllNodes: GraphNode[],
  graphNodes: GraphNodes,
  graphEdges: GraphEdges,
  weightCutoff: number
) {
  const edges = { ...graphEdges };
  sortedAllNodes.reverse().forEach((node) => {
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

export function edgeEntropyScore(edges: GraphEdge[], self: number) {
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

export function makeEdgeKey(source: string, target: string) {
  return `${source}-${target}`;
}

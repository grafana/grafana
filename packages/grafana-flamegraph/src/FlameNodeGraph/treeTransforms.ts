import { LevelItem } from '../FlameGraph/dataTransform';

export type GraphNode = {
  label: string;
  self: number;
  value: number;
  parents: GraphEdge[];
  children: GraphEdge[];
};

export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  weight: number;
  // Residual means it is a skip level node. This happens as we trim the tree based on node priorities and sometimes
  // we remove intermediate node.
  residual: boolean;
};

export type GraphNodes = { [key: string]: GraphNode };
export type GraphEdges = { [key: string]: GraphEdge };

/**
 * Instead of a call tree we make a graph where each function of the profile is only once in the graph. So we merge
 * the nodes and sum the values and merge the parent/child relationships.
 * @param root
 */
export function treeToGraph(root: LevelItem) {
  let graphNodes: GraphNodes = {};
  const graphEdges: GraphEdges = {};

  // again skipping the root as we don't want to show it in graph
  const stack = [...root.children];

  while (stack.length) {
    const currentNode = stack.pop()!;

    if (!graphNodes[currentNode.label]) {
      graphNodes[currentNode.label] = {
        label: currentNode.label,
        self: currentNode.self,
        value: currentNode.value,
        parents: [],
        children: [],
      };
    } else {
      graphNodes[currentNode.label].self += currentNode.self;
      graphNodes[currentNode.label].value += currentNode.value;
    }

    if (currentNode.parents) {
      for (let parent of currentNode.parents) {
        if (parent.label === currentNode.label) {
          // If function calls itself we don't need to add and edge as we will merge those nodes.
          break;
        }

        const edgeKey = makeEdgeKey(parent.label, currentNode.label);
        if (!graphEdges[edgeKey]) {
          graphEdges[edgeKey] = {
            from: graphNodes[parent.label],
            to: graphNodes[currentNode.label],
            weight: parent.value,
            residual: false,
          };
          graphNodes[currentNode.label].parents.push(graphEdges[edgeKey]);
          graphNodes[parent.label].children.push(graphEdges[edgeKey]);
        } else {
          graphEdges[edgeKey].weight += parent.value;
        }
      }
    }
    stack.push(...currentNode.children);
  }

  return { nodes: graphNodes, edges: graphEdges };
}

export function makeEdgeKey(source: string, target: string) {
  return `${source}-${target}`;
}

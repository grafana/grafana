// @ts-ignore
import vis from 'visjs-network';

import { VariableModel } from '../../templating/types';
import { variableAdapters } from '../adapters';

interface GraphNode {
  id: string;
  label: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

export const createNodes = (variables: VariableModel[]): GraphNode[] => {
  const nodes: GraphNode[] = [];

  for (const variable of variables) {
    nodes.push({ id: variable.id, label: `$${variable.id}` });
  }

  return nodes;
};

export const createEdges = (variables: VariableModel[]): GraphEdge[] => {
  const edges: GraphEdge[] = [];

  for (const variable of variables) {
    for (const other of variables) {
      if (variable === other) {
        continue;
      }

      const dependsOn = variableAdapters.get(variable.type).dependsOn(variable, other);

      if (dependsOn) {
        edges.push({ from: variable.id, to: other.id });
      }
    }
  }

  return edges;
};

export const toVisNetworkNodes = (nodes: GraphNode[]): any[] => {
  const nodesWithStyle: any[] = nodes.map(node => ({ ...node, shape: 'box', font: { size: 20 } }));
  return new vis.DataSet(nodesWithStyle);
};

export const toVisNetworkEdges = (edges: GraphEdge[]): any[] => {
  const edgesWithStyle: any[] = edges.map(edge => ({ ...edge, arrows: 'to', dashes: true }));
  return new vis.DataSet(edgesWithStyle);
};

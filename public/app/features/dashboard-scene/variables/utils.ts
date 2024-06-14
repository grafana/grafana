import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { GraphEdge, GraphNode } from 'app/features/variables/inspect/utils';

export function createDependencyNodes(variables: Array<SceneVariable<SceneVariableState>>): GraphNode[] {
  return variables.map((variable) => ({ id: variable.state.name, label: `${variable.state.name}` }));
}

export function filterNodesWithDependencies(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  return nodes.filter((node) => edges.some((edge) => edge.from === node.id || edge.to === node.id));
}

export const createDependencyEdges = (variables: Array<SceneVariable<SceneVariableState>>): GraphEdge[] => {
  const edges: GraphEdge[] = [];
  for (const variable of variables) {
    for (const other of variables) {
      if (variable === other) {
        continue;
      }

      const dependsOn = variable.variableDependency?.hasDependencyOn(other.state.name);
      if (dependsOn) {
        edges.push({ from: variable.state.name, to: other.state.name });
      }
    }
  }

  return edges;
};

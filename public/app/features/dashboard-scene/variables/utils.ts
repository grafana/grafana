import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { GraphEdge, GraphNode, getPropsWithVariable } from 'app/features/variables/inspect/utils';

import { DashboardScene } from '../scene/DashboardScene';

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

export interface VariableUsageTree {
  variable: SceneVariable<SceneVariableState>;
  tree: unknown;
}

export interface UsagesToNetwork {
  variable: SceneVariable<SceneVariableState>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  showGraph: boolean;
}

export function createUsagesNetwork(variables: Array<SceneVariable<SceneVariableState>>, dashboard: DashboardScene) {
  if (!dashboard) {
    return [];
  }

  let usages: VariableUsageTree[] = [];
  const model = dashboard.getInitialSaveModel();

  for (const variable of variables) {
    const variableId = variable.state.name;
    const props = getPropsWithVariable(variableId, { key: 'model', value: model }, {});

    if (Object.keys(props).length) {
      usages.push({ variable, tree: props });
    }
  }

  return usages;
}

export function transformUsagesToNetwork(usages: VariableUsageTree[]): UsagesToNetwork[] {
  const results: UsagesToNetwork[] = [];

  for (const usage of usages) {
    const { variable, tree } = usage;
    const result: UsagesToNetwork = {
      variable,
      nodes: [{ id: 'dashboard', label: 'dashboard' }],
      edges: [],
      showGraph: false,
    };
    results.push(traverseTree(result, { id: 'dashboard', value: tree }));
  }

  return results;
}

export const traverseTree = (usage: UsagesToNetwork, parent: { id: string; value: unknown }): UsagesToNetwork => {
  const { id, value } = parent;
  const { nodes, edges } = usage;

  if (value && typeof value === 'string') {
    const leafId = `${parent.id}-${value}`;
    nodes.push({ id: leafId, label: value });
    edges.push({ from: leafId, to: id });

    return usage;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    for (const key of keys) {
      const leafId = `${parent.id}-${key}`;
      nodes.push({ id: leafId, label: key });
      edges.push({ from: leafId, to: id });
      usage = traverseTree(usage, { id: leafId, value: value[key] });
    }

    return usage;
  }

  return usage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

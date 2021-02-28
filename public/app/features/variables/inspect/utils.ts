// @ts-ignore
import vis from 'visjs-network';

import { variableAdapters } from '../adapters';
import { DashboardModel } from '../../dashboard/state';
import { isAdHoc } from '../guard';
import { safeStringifyValue } from '../../../core/utils/explore';
import { VariableModel } from '../types';
import { containsVariable, variableRegex } from '../utils';

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export const createDependencyNodes = (variables: VariableModel[]): GraphNode[] => {
  const nodes: GraphNode[] = [];

  for (const variable of variables) {
    nodes.push({ id: variable.id, label: `${variable.id}` });
  }

  return nodes;
};

export const filterNodesWithDependencies = (nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] => {
  return nodes.filter((node) => edges.some((edge) => edge.from === node.id || edge.to === node.id));
};

export const createDependencyEdges = (variables: VariableModel[]): GraphEdge[] => {
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
  const nodesWithStyle: any[] = nodes.map((node) => ({
    ...node,
    shape: 'box',
  }));
  return new vis.DataSet(nodesWithStyle);
};

export const toVisNetworkEdges = (edges: GraphEdge[]): any[] => {
  const edgesWithStyle: any[] = edges.map((edge) => ({ ...edge, arrows: 'to', dashes: true }));
  return new vis.DataSet(edgesWithStyle);
};

export const getUnknownVariableStrings = (variables: VariableModel[], model: any) => {
  const unknownVariableNames: string[] = [];
  const modelAsString = safeStringifyValue(model, 2);
  const matches = modelAsString.match(variableRegex);

  if (!matches) {
    return unknownVariableNames;
  }

  for (const match of matches) {
    if (!match) {
      continue;
    }

    if (match.indexOf('$__') !== -1) {
      // ignore builtin variables
      continue;
    }

    if (match.indexOf('$hashKey') !== -1) {
      // ignore Angular props
      continue;
    }

    const variableName = match.slice(1);

    if (variables.some((variable) => variable.id === variableName)) {
      // ignore defined variables
      continue;
    }

    if (unknownVariableNames.find((name) => name === variableName)) {
      continue;
    }

    unknownVariableNames.push(variableName);
  }

  return unknownVariableNames;
};

export const getPropsWithVariable = (variableId: string, parent: { key: string; value: any }, result: any) => {
  const stringValues = Object.keys(parent.value).reduce((all, key) => {
    const value = parent.value[key];
    if (value && typeof value === 'string' && containsVariable(value, variableId)) {
      all = {
        ...all,
        [key]: value,
      };
    }

    return all;
  }, {});

  const objectValues = Object.keys(parent.value).reduce((all, key) => {
    const value = parent.value[key];
    if (value && typeof value === 'object' && Object.keys(value).length) {
      const id = value.title || value.name || value.id || key;
      const newResult = getPropsWithVariable(variableId, { key, value }, {});
      if (Object.keys(newResult).length) {
        all = {
          ...all,
          [id]: newResult,
        };
      }
    }

    return all;
  }, {});

  if (Object.keys(stringValues).length || Object.keys(objectValues).length) {
    result = {
      ...result,
      ...stringValues,
      ...objectValues,
    };
  }

  return result;
};

export interface VariableUsages {
  unUsed: VariableModel[];
  unknown: Array<{ variable: VariableModel; tree: any }>;
  usages: Array<{ variable: VariableModel; tree: any }>;
}

export const createUsagesNetwork = (variables: VariableModel[], dashboard: DashboardModel | null): VariableUsages => {
  if (!dashboard) {
    return { unUsed: [], unknown: [], usages: [] };
  }

  const unUsed: VariableModel[] = [];
  let usages: Array<{ variable: VariableModel; tree: any }> = [];
  let unknown: Array<{ variable: VariableModel; tree: any }> = [];
  const model = dashboard.getSaveModelClone();

  const unknownVariables = getUnknownVariableStrings(variables, model);
  for (const unknownVariable of unknownVariables) {
    const props = getPropsWithVariable(unknownVariable, { key: 'model', value: model }, {});
    if (Object.keys(props).length) {
      const variable = ({ id: unknownVariable, name: unknownVariable } as unknown) as VariableModel;
      unknown.push({ variable, tree: props });
    }
  }

  for (const variable of variables) {
    const variableId = variable.id;
    const props = getPropsWithVariable(variableId, { key: 'model', value: model }, {});
    if (!Object.keys(props).length && !isAdHoc(variable)) {
      unUsed.push(variable);
    }

    if (Object.keys(props).length) {
      usages.push({ variable, tree: props });
    }
  }

  return { unUsed, unknown, usages };
};

export interface UsagesToNetwork {
  variable: VariableModel;
  nodes: GraphNode[];
  edges: GraphEdge[];
  showGraph: boolean;
}

export const traverseTree = (usage: UsagesToNetwork, parent: { id: string; value: any }): UsagesToNetwork => {
  const { id, value } = parent;
  const { nodes, edges } = usage;

  if (value && typeof value === 'string') {
    const leafId = `${parent.id}-${value}`;
    nodes.push({ id: leafId, label: value });
    edges.push({ from: leafId, to: id });

    return usage;
  }

  if (value && typeof value === 'object') {
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

export const transformUsagesToNetwork = (usages: Array<{ variable: VariableModel; tree: any }>): UsagesToNetwork[] => {
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
};

const countLeaves = (object: any): number => {
  const total = Object.values(object).reduce((count: number, value: any) => {
    if (typeof value === 'object') {
      return count + countLeaves(value);
    }

    return count + 1;
  }, 0);

  return (total as unknown) as number;
};

export const getVariableUsages = (
  variableId: string,
  variables: VariableModel[],
  dashboard: DashboardModel | null
): number => {
  const { usages } = createUsagesNetwork(variables, dashboard);
  const usage = usages.find((usage) => usage.variable.id === variableId);
  if (!usage) {
    return 0;
  }

  return countLeaves(usage.tree);
};

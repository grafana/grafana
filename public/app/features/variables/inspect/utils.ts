import { variableAdapters } from '../adapters';
import { DashboardModel, PanelModel } from '../../dashboard/state';
import { isAdHoc } from '../guard';
import { safeStringifyValue } from '../../../core/utils/explore';
import { VariableModel } from '../types';
import { containsVariable, variableRegex, variableRegexExec } from '../utils';
import { DataLinkBuiltInVars } from '@grafana/data';

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

function getVariableName(expression: string) {
  const match = variableRegexExec(expression);
  if (!match) {
    return null;
  }
  const variableName = match.slice(1).find((match) => match !== undefined);
  return variableName;
}

export const getUnknownVariableStrings = (variables: VariableModel[], model: any) => {
  variableRegex.lastIndex = 0;
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

    if (match.indexOf('${__') !== -1) {
      // ignore builtin variables
      continue;
    }

    if (match.indexOf('$hashKey') !== -1) {
      // ignore Angular props
      continue;
    }

    const variableName = getVariableName(match);

    if (variables.some((variable) => variable.id === variableName)) {
      // ignore defined variables
      continue;
    }

    if (unknownVariableNames.find((name) => name === variableName)) {
      continue;
    }

    if (variableName) {
      unknownVariableNames.push(variableName);
    }
  }

  return unknownVariableNames;
};

const validVariableNames: Record<string, RegExp[]> = {
  alias: [/^m$/, /^measurement$/, /^col$/, /^tag_(\w+|\d+)$/],
  query: [/^timeFilter$/],
};

export const getPropsWithVariable = (variableId: string, parent: { key: string; value: any }, result: any) => {
  const stringValues = Object.keys(parent.value).reduce((all, key) => {
    const value = parent.value[key];
    if (!value || typeof value !== 'string') {
      return all;
    }

    const isValidName = validVariableNames[key]
      ? validVariableNames[key].find((regex: RegExp) => regex.test(variableId))
      : undefined;

    let hasVariable = containsVariable(value, variableId);
    if (key === 'repeat' && value === variableId) {
      // repeat stores value without variable format
      hasVariable = true;
    }

    if (!isValidName && hasVariable) {
      all = {
        ...all,
        [key]: value,
      };
    }

    return all;
  }, {} as Record<string, any>);

  const objectValues = Object.keys(parent.value).reduce((all, key) => {
    const value = parent.value[key];
    if (value && typeof value === 'object' && Object.keys(value).length) {
      let id = value.title || value.name || value.id || key;
      if (Array.isArray(parent.value) && parent.key === 'panels') {
        id = `${id}[${value.id}]`;
      }

      const newResult = getPropsWithVariable(variableId, { key, value }, {});

      if (Object.keys(newResult).length) {
        all = {
          ...all,
          [id]: newResult,
        };
      }
    }

    return all;
  }, {} as Record<string, any>);

  if (Object.keys(stringValues).length || Object.keys(objectValues).length) {
    result = {
      ...result,
      ...stringValues,
      ...objectValues,
    };
  }

  return result;
};

export interface VariableUsageTree {
  variable: VariableModel;
  tree: any;
}

export interface VariableUsages {
  unUsed: VariableModel[];
  unknown: VariableUsageTree[];
  usages: VariableUsageTree[];
}

export const createUsagesNetwork = (variables: VariableModel[], dashboard: DashboardModel | null): VariableUsages => {
  if (!dashboard) {
    return { unUsed: [], unknown: [], usages: [] };
  }

  const unUsed: VariableModel[] = [];
  let usages: VariableUsageTree[] = [];
  let unknown: VariableUsageTree[] = [];
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

/*
  getAllAffectedPanelIdsForVariableChange is a function that extracts all the panel ids that are affected by a single variable
  change. It will traverse all chained variables to identify all cascading changes too.

  This is done entirely by parsing the current dashboard json and doesn't take under consideration a user cancelling
  a variable query or any faulty variable queries.

  This doesn't take circular dependencies in consideration.
 */
export function getAllAffectedPanelIdsForVariableChange(
  variableId: string,
  variables: VariableModel[],
  panels: PanelModel[]
): number[] {
  let affectedPanelIds: number[] = getAffectedPanelIdsForVariable(variableId, panels);
  const affectedPanelIdsForAllVariables = getAffectedPanelIdsForVariable(DataLinkBuiltInVars.includeVars, panels);
  affectedPanelIds = [...new Set([...affectedPanelIdsForAllVariables, ...affectedPanelIds])];

  const dependencies = getDependenciesForVariable(variableId, variables, new Set());
  for (const dependency of dependencies) {
    const affectedPanelIdsForDependency = getAffectedPanelIdsForVariable(dependency, panels);
    affectedPanelIds = [...new Set([...affectedPanelIdsForDependency, ...affectedPanelIds])];
  }

  return affectedPanelIds;
}

export function getDependenciesForVariable(
  variableId: string,
  variables: VariableModel[],
  deps: Set<string>
): Set<string> {
  if (!variables.length) {
    return deps;
  }

  for (const variable of variables) {
    if (variable.name === variableId) {
      continue;
    }

    const depends = variableAdapters.get(variable.type).dependsOn(variable, { name: variableId });
    if (!depends) {
      continue;
    }

    deps.add(variable.name);
    deps = getDependenciesForVariable(variable.name, variables, deps);
  }

  return deps;
}

export function getAffectedPanelIdsForVariable(variableId: string, panels: PanelModel[]): number[] {
  if (!panels.length) {
    return [];
  }

  const affectedPanelIds: number[] = [];
  const repeatRegex = new RegExp(`"repeat":"${variableId}"`);
  for (const panel of panels) {
    const panelAsJson = safeStringifyValue(panel.getSaveModel());

    // check for repeats that don't use variableRegex
    const repeatMatches = panelAsJson.match(repeatRegex);
    if (repeatMatches?.length) {
      affectedPanelIds.push(panel.id);
      continue;
    }

    const matches = panelAsJson.match(variableRegex);
    if (!matches) {
      continue;
    }

    for (const match of matches) {
      const variableName = getVariableName(match);
      if (variableName === variableId) {
        affectedPanelIds.push(panel.id);
        break;
      }
    }
  }

  return affectedPanelIds;
}

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

export const transformUsagesToNetwork = (usages: VariableUsageTree[]): UsagesToNetwork[] => {
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

export const getVariableUsages = (variableId: string, usages: VariableUsageTree[]): number => {
  const usage = usages.find((usage) => usage.variable.id === variableId);
  if (!usage) {
    return 0;
  }

  return countLeaves(usage.tree);
};

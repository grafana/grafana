import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { safeStringifyValue } from 'app/core/utils/explore';
import { GraphEdge, GraphNode, getPropsWithVariable } from 'app/features/variables/inspect/utils';

export const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

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
  /** string when unknown/missing variable otherwise SceneVariable */
  variable: string | SceneVariable<SceneVariableState>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  showGraph: boolean;
}

export function createUsagesNetwork(variables: Array<SceneVariable<SceneVariableState>>, dashboard: Dashboard) {
  if (!dashboard) {
    return [];
  }

  let usages: VariableUsageTree[] = [];

  for (const variable of variables) {
    const variableId = variable.state.name;
    const props = getPropsWithVariable(variableId, { key: 'model', value: dashboard }, {});

    if (Object.keys(props).length) {
      usages.push({ variable, tree: props });
    }
  }

  return usages;
}

export function transformUsagesToNetwork(
  usages: Array<VariableUsageTree | UnknownVariableUsageTree>
): UsagesToNetwork[] {
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

export const getVariableUsages = (variableId: string, usages: VariableUsageTree[]): number => {
  const usage = usages.find((usage) => usage.variable.state.name === variableId);
  if (!usage) {
    return 0;
  }

  if (isRecord(usage.tree)) {
    return countLeaves(usage.tree);
  }

  return 0;
};

const countLeaves = (object: object): number => {
  const total = Object.values(object).reduce<number>((count, value) => {
    if (typeof value === 'object') {
      return count + countLeaves(value);
    }

    return count + 1;
  }, 0);

  return total;
};

export async function getUnknownsNetwork(
  variables: Array<SceneVariable<SceneVariableState>>,
  dashboard: Dashboard | null
): Promise<UsagesToNetwork[]> {
  return new Promise((resolve, reject) => {
    // can be an expensive call so we avoid blocking the main thread
    setTimeout(() => {
      try {
        const unknowns = createUnknownsNetwork(variables, dashboard);
        resolve(transformUsagesToNetwork(unknowns));
      } catch (e) {
        reject(e);
      }
    }, 200);
  });
}

type UnknownVariableUsageTree = {
  variable: string;
  tree: unknown;
};

function createUnknownsNetwork(
  variables: Array<SceneVariable<SceneVariableState>>,
  dashboard: Dashboard | null
): UnknownVariableUsageTree[] {
  if (!dashboard) {
    return [];
  }

  let unknown: UnknownVariableUsageTree[] = [];
  const unknownVariables = getUnknownVariableStrings(variables, dashboard);
  for (const unknownVariable of unknownVariables) {
    const props = getPropsWithVariable(unknownVariable, { key: 'model', value: dashboard }, {});
    if (Object.keys(props).length) {
      unknown.push({ variable: unknownVariable, tree: props });
    }
  }

  return unknown;
}

export const getUnknownVariableStrings = (variables: Array<SceneVariable<SceneVariableState>>, model: Dashboard) => {
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

    if (variables.some((variable) => variable.state.name === variableName)) {
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

export function getVariableName(expression: string) {
  const match = variableRegexExec(expression);
  if (!match) {
    return undefined;
  }
  const variableName = match.slice(1).find((match) => match !== undefined);

  // ignore variables that match inherited object prop names
  if (variableName! in {}) {
    return undefined;
  }

  return variableName;
}

// Helper function since lastIndex is not reset
export const variableRegexExec = (variableString: string) => {
  variableRegex.lastIndex = 0;
  return variableRegex.exec(variableString);
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

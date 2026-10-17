import { DataLinkBuiltInVars } from '@grafana/data';
import { type Graph } from 'app/core/utils/dag';
import { mapSet } from 'app/core/utils/set';
import { stringifyPanelModel } from 'app/features/dashboard/state/PanelModel';

import { PanelModel } from '../../dashboard/state/PanelModel';
import { containsVariable, variableRegexExec } from '../utils';
import { variableRegex } from '../variableRegex';

import { type UsagesToNetwork } from './types';

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

const validVariableNames: Record<string, RegExp[]> = {
  alias: [/^m$/, /^measurement$/, /^col$/, /^tag_(\w+|\d+)$/],
  query: [/^timeFilter$/],
};

export const getPropsWithVariable = (variableId: string, parent: { key: string; value: any }, result: any) => {
  const stringValues = Object.keys(parent.value).reduce<Record<string, string>>((all, key) => {
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
  }, {});

  const objectValues = Object.keys(parent.value).reduce<Record<string, object>>((all, key) => {
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

/*
  getAllAffectedPanelIdsForVariableChange is a function that extracts all the panel ids that are affected by a single variable
  change. It will traverse all chained variables to identify all cascading changes too.

  This is done entirely by parsing the current dashboard json and doesn't take under consideration a user cancelling
  a variable query or any faulty variable queries.

  This doesn't take circular dependencies in consideration.
 */

export function getAllAffectedPanelIdsForVariableChange(
  variableIds: string[],
  variableGraph: Graph,
  panelsByVar: Record<string, Set<number>>
): Set<number> {
  const allDependencies = mapSet(variableGraph.descendants(variableIds), (n) => n.name);
  allDependencies.add(DataLinkBuiltInVars.includeVars);
  for (const id of variableIds) {
    allDependencies.add(id);
  }

  const affectedPanelIds = getDependentPanels([...allDependencies], panelsByVar);
  return affectedPanelIds;
}

// Return an array of panel IDs depending on variables
function getDependentPanels(variables: string[], panelsByVarUsage: Record<string, Set<number>>) {
  const thePanels: number[] = [];
  for (const varId of variables) {
    if (panelsByVarUsage[varId]) {
      thePanels.push(...panelsByVarUsage[varId]);
    }
  }

  return new Set(thePanels);
}

const traverseTree = (usage: UsagesToNetwork, parent: { id: string; value: any }): UsagesToNetwork => {
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

const countLeaves = (object: object): number => {
  const total = Object.values(object).reduce<number>((count, value) => {
    if (typeof value === 'object') {
      return count + countLeaves(value);
    }

    return count + 1;
  }, 0);

  return total;
};

export function flattenPanels(panels: PanelModel[]): PanelModel[] {
  const result: PanelModel[] = [];

  for (const panel of panels) {
    result.push(panel);
    if (panel.panels?.length) {
      result.push(...flattenPanels(panel.panels.map((p: PanelModel) => new PanelModel(p))));
    }
  }

  return result;
}

// Accepts an array of panel models, and returns an array of panel IDs paired with
// the names of any template variables found
export function getPanelVars(panels: PanelModel[]) {
  const panelsByVar: Record<string, Set<number>> = {};
  for (const p of panels) {
    const jsonString = stringifyPanelModel(p);
    const repeats = [...jsonString.matchAll(/"repeat":"([^"]+)"/g)].map((m) => m[1]);
    const varRegexMatches = jsonString.match(variableRegex)?.map((m) => getVariableName(m)) ?? [];
    const varNames = [...repeats, ...varRegexMatches];
    for (const varName of varNames) {
      if (varName! in panelsByVar) {
        panelsByVar[varName!].add(p.id);
      } else {
        panelsByVar[varName!] = new Set([p.id]);
      }
    }
  }

  return panelsByVar;
}

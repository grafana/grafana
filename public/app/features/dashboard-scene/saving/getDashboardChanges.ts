import { compare, Operation } from 'fast-json-patch';
// @ts-ignore
import jsonMap from 'json-source-map';
import { flow, get, isEqual, sortBy, tail } from 'lodash';

import { AdHocVariableModel, TypedVariableModel } from '@grafana/data';
import { Dashboard } from '@grafana/schema';

export function getDashboardChanges(
  initial: Dashboard,
  changed: Dashboard,
  saveTimeRange?: boolean,
  saveVariables?: boolean
) {
  const initialSaveModel = initial;
  const changedSaveModel = changed;
  const hasTimeChanged = getHasTimeChanged(changedSaveModel, initialSaveModel);
  const hasVariableValueChanges = applyVariableChanges(changedSaveModel, initialSaveModel, saveVariables);

  if (!saveTimeRange) {
    changedSaveModel.time = initialSaveModel.time;
  }

  const diff = jsonDiff(initialSaveModel, changedSaveModel);

  let diffCount = 0;
  for (const d of Object.values(diff)) {
    diffCount += d.length;
  }
  return {
    changedSaveModel,
    initialSaveModel,
    diffs: diff,
    diffCount,
    hasChanges: diffCount > 0,
    hasTimeChanges: hasTimeChanged,
    isNew: changedSaveModel.version === 0,
    hasVariableValueChanges,
  };
}

export function getHasTimeChanged(saveModel: Dashboard, originalSaveModel: Dashboard) {
  return saveModel.time?.from !== originalSaveModel.time?.from || saveModel.time?.to !== originalSaveModel.time?.to;
}

export function applyVariableChanges(saveModel: Dashboard, originalSaveModel: Dashboard, saveVariables?: boolean) {
  const originalVariables = originalSaveModel.templating?.list ?? [];
  const variablesToSave = saveModel.templating?.list ?? [];
  let hasVariableValueChanges = false;

  for (const variable of variablesToSave) {
    const original = originalVariables.find(({ name, type }) => name === variable.name && type === variable.type);

    if (!original) {
      continue;
    }

    // Old schema property that never should be in persisted model
    if (original.current && Object.hasOwn(original.current, 'selected')) {
      delete original.current.selected;
    }

    if (!isEqual(variable.current, original.current)) {
      hasVariableValueChanges = true;
    }

    if (!saveVariables) {
      const typed = variable as TypedVariableModel;
      if (typed.type === 'adhoc') {
        typed.filters = (original as AdHocVariableModel).filters;
      } else {
        variable.current = original.current;
        variable.options = original.options;
      }
    }
  }

  return hasVariableValueChanges;
}

export type Diff = {
  op: 'add' | 'replace' | 'remove' | 'copy' | 'test' | '_get' | 'move';
  value: unknown;
  originalValue: unknown;
  path: string[];
  startLineNumber: number;
};

export type Diffs = {
  [key: string]: Diff[];
};

export type JSONValue = string | Dashboard;

export const jsonDiff = (lhs: JSONValue, rhs: JSONValue): Diffs => {
  const diffs = compare(lhs, rhs);
  const lhsMap = jsonMap.stringify(lhs, null, 2);
  const rhsMap = jsonMap.stringify(rhs, null, 2);

  const getDiffInformation = (diffs: Operation[]): Diff[] => {
    return diffs.map((diff) => {
      let originalValue = undefined;
      let value = undefined;
      let startLineNumber = 0;

      const path = tail(diff.path.split('/'));

      if (diff.op === 'replace' && rhsMap.pointers[diff.path]) {
        originalValue = get(lhs, path);
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'add' && rhsMap.pointers[diff.path]) {
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'remove' && lhsMap.pointers[diff.path]) {
        originalValue = get(lhs, path);
        startLineNumber = lhsMap.pointers[diff.path].value.line;
      }

      return {
        op: diff.op,
        value,
        path,
        originalValue,
        startLineNumber,
      };
    });
  };

  const sortByLineNumber = (diffs: Diff[]) => sortBy(diffs, 'startLineNumber');
  const groupByPath = (diffs: Diff[]) =>
    diffs.reduce<Record<string, Diff[]>>((acc, value) => {
      const groupKey: string = value.path[0];
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(value);
      return acc;
    }, {});

  //   return 1;
  return flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};

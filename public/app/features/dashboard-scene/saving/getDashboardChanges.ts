// @ts-ignore
import jsonMap from 'json-source-map';

import type { AdHocVariableModel, TypedVariableModel } from '@grafana/data';
import { Dashboard, Panel, VariableOption } from '@grafana/schema';

import { jsonDiff } from '../settings/version-history/utils';

export function get(obj: any, keys: string[]) {
  try {
    let val = obj;
    for (const key of keys) {
      val = val[key];
    }
    return val;
  } catch (err) {
    return undefined;
  }
}

export function deepEqual(a: string | string[], b: string | string[]) {
  return (
    typeof a === typeof b &&
    ((typeof a === 'string' && a === b) ||
      (Array.isArray(a) && a.length === b.length && a.every((val, i) => val === b[i])))
  );
}

export function isEqual(a: VariableOption | undefined, b: VariableOption | undefined) {
  return a === b || (a && b && a.selected === b.selected && deepEqual(a.text, b.text) && deepEqual(a.value, b.value));
}

export function getDashboardChanges(
  initial: Dashboard,
  changed: Dashboard,
  saveTimeRange?: boolean,
  saveVariables?: boolean,
  saveRefresh?: boolean
) {
  const initialSaveModel = initial;
  const changedSaveModel = changed;
  const hasTimeChanged = getHasTimeChanged(changedSaveModel, initialSaveModel);
  const hasVariableValueChanges = applyVariableChanges(changedSaveModel, initialSaveModel, saveVariables);
  const hasRefreshChanged = changedSaveModel.refresh !== initialSaveModel.refresh;

  if (!saveTimeRange) {
    changedSaveModel.time = initialSaveModel.time;
  }

  if (!saveRefresh) {
    changedSaveModel.refresh = initialSaveModel.refresh;
  }

  const diff = jsonDiff(initialSaveModel, changedSaveModel);
  const diffCount = Object.values(diff).reduce((acc, cur) => acc + cur.length, 0);

  return {
    changedSaveModel,
    initialSaveModel,
    diffs: diff,
    diffCount,
    hasChanges: diffCount > 0,
    hasTimeChanges: hasTimeChanged,
    isNew: changedSaveModel.version === 0,
    hasVariableValueChanges,
    hasRefreshChange: hasRefreshChanged,
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
    if (original.current) {
      delete original.current.selected;
    }

    if (!isEqual(variable.current, original.current)) {
      hasVariableValueChanges = true;
    }

    if (!saveVariables) {
      const typed = variable as TypedVariableModel;
      if (typed.type === 'adhoc') {
        typed.filters = (original as AdHocVariableModel).filters;
      } else if (typed.type !== 'groupby') {
        variable.current = original.current;
        variable.options = original.options;
      }
    }
  }

  return hasVariableValueChanges;
}

export function getPanelChanges(saveModel: Panel, originalSaveModel: Panel) {
  const diff = jsonDiff(originalSaveModel, saveModel);
  const diffCount = Object.values(diff).reduce((acc, cur) => acc + cur.length, 0);

  return {
    changedSaveModel: saveModel,
    initialSaveModel: originalSaveModel,
    diffs: diff,
    diffCount,
    hasChanges: diffCount > 0,
  };
}

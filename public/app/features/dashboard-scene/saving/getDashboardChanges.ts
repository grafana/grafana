// @ts-ignore

import type { AdHocVariableModel, TypedVariableModel } from '@grafana/data';
import { Dashboard, Panel, VariableOption } from '@grafana/schema';
import {
  AdHocFilterWithLabels,
  AdhocVariableSpec,
  DashboardV2Spec,
  VariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

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

export function getRawDashboardV2Changes(
  initial: DashboardV2Spec,
  changed: DashboardV2Spec,
  saveTimeRange?: boolean,
  saveVariables?: boolean,
  saveRefresh?: boolean
) {
  const initialSaveModel = initial;
  const changedSaveModel = changed;
  const hasTimeChanged = getHasTimeChanged(changedSaveModel.timeSettings, initialSaveModel.timeSettings);
  const hasVariableValueChanges = applyVariableChangesV2(changedSaveModel, initialSaveModel, saveVariables);
  const hasRefreshChanged = changedSaveModel.timeSettings.autoRefresh !== initialSaveModel.timeSettings.autoRefresh;

  if (!saveTimeRange) {
    changedSaveModel.timeSettings.from = initialSaveModel.timeSettings.from;
    changedSaveModel.timeSettings.to = initialSaveModel.timeSettings.to;
  }

  if (!saveRefresh) {
    changedSaveModel.timeSettings.autoRefresh = initialSaveModel.timeSettings.autoRefresh;
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
    hasVariableValueChanges,
    hasRefreshChange: hasRefreshChanged,
  };
}

export function getRawDashboardChanges(
  initial: Dashboard,
  changed: Dashboard,
  saveTimeRange?: boolean,
  saveVariables?: boolean,
  saveRefresh?: boolean
) {
  const initialSaveModel = initial;
  const changedSaveModel = changed;
  const hasTimeChanged = getHasTimeChanged(changedSaveModel.time, initialSaveModel.time);
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

interface DefaultPersistedTimeValue {
  from?: string;
  to?: string;
}
export function getHasTimeChanged(
  newRange: DefaultPersistedTimeValue = {},
  previousRange: DefaultPersistedTimeValue = {}
) {
  return newRange.from !== previousRange.from || newRange.to !== previousRange.to;
}

export function adHocVariableFiltersEqual(filtersA?: AdHocFilterWithLabels[], filtersB?: AdHocFilterWithLabels[]) {
  if (filtersA === undefined && filtersB === undefined) {
    console.warn('Adhoc variable filter property is undefined');
    return true;
  }

  if ((filtersA === undefined && filtersB !== undefined) || (filtersB === undefined && filtersA !== undefined)) {
    console.warn('Adhoc variable filter property is undefined');
    return false;
  }

  if (filtersA?.length !== filtersB?.length) {
    return false;
  }

  for (let i = 0; i < (filtersA?.length ?? 0); i++) {
    const aFilter = filtersA?.[i];
    const bFilter = filtersB?.[i];
    if (aFilter?.key !== bFilter?.key || aFilter?.operator !== bFilter?.operator || aFilter?.value !== bFilter?.value) {
      return false;
    }
  }
  return true;
}

export function applyVariableChangesV2(
  saveModel: DashboardV2Spec,
  originalSaveModel: DashboardV2Spec,
  saveVariables?: boolean
) {
  const originalVariables = originalSaveModel.variables ?? [];
  const variablesToSave = saveModel.variables ?? [];
  let hasVariableValueChanges = false;

  for (const variable of variablesToSave) {
    const hasCurrentValueToSave = (v: VariableKind) =>
      v.kind === 'QueryVariable' ||
      v.kind === 'CustomVariable' ||
      v.kind === 'DatasourceVariable' ||
      v.kind === 'ConstantVariable' ||
      v.kind === 'IntervalVariable' ||
      v.kind === 'TextVariable' ||
      v.kind === 'GroupByVariable';

    const hasOptionsToSave = (v: VariableKind) =>
      v.kind === 'QueryVariable' ||
      v.kind === 'CustomVariable' ||
      v.kind === 'DatasourceVariable' ||
      v.kind === 'IntervalVariable' ||
      v.kind === 'GroupByVariable';

    const original = originalVariables.find(
      ({ spec, kind }) => spec.name === variable.spec.name && kind === variable.kind
    );

    if (!original) {
      continue;
    }

    if (
      hasCurrentValueToSave(variable) &&
      hasCurrentValueToSave(original) &&
      !isEqual(variable.spec.current, original.spec.current)
    ) {
      hasVariableValueChanges = true;
    } else if (
      variable.kind === 'AdhocVariable' &&
      original.kind === 'AdhocVariable' &&
      !adHocVariableFiltersEqual(variable.spec.filters, original.spec.filters)
    ) {
      hasVariableValueChanges = true;
    }

    if (!saveVariables) {
      if (variable.kind === 'AdhocVariable') {
        variable.spec.filters = (original.spec as AdhocVariableSpec).filters;
      } else {
        if (hasCurrentValueToSave(variable) && hasCurrentValueToSave(original)) {
          variable.spec.current = original.spec.current;
        }
        if (hasOptionsToSave(variable) && hasOptionsToSave(original)) {
          variable.spec.options = original.spec.options;
        }
      }
    }
  }

  return hasVariableValueChanges;
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
    } else if (
      variable.type === 'adhoc' &&
      !adHocVariableFiltersEqual(
        (variable as AdHocVariableModel | undefined)?.filters,
        (original as AdHocVariableModel | undefined)?.filters
      )
    ) {
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

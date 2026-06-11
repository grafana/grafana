import type { AdHocVariableModel, TextBoxVariableModel, TypedVariableModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type Dashboard, type VariableOption } from '@grafana/schema';
import {
  type AdHocFilterWithLabels,
  type Spec as DashboardV2Spec,
  type VariableKind,
  type CustomVariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { ResponseTransformers } from 'app/features/dashboard/api/ResponseTransformers';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { type DashboardDataDTO, type DashboardDTO } from 'app/types/dashboard';

import { validateFiltersOrigin } from '../serialization/sceneVariablesSetToVariables';
import { jsonDiff } from '../settings/version-history/utils';

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
  initial: DashboardV2Spec | Dashboard,
  changed: DashboardV2Spec,
  saveTimeRange?: boolean,
  saveVariables?: boolean,
  saveRefresh?: boolean
) {
  // Transform initial dashboard values to v2 spec format to ensure consistent comparison of time settings,
  // variables and refresh values. This handles cases where the initial dashboard is in v1 format
  // but was converted to v2 during runtime due to dynamic dashboard features being used.
  const initialSaveModel = convertToV2SpecIfNeeded(initial);
  const changedSaveModel = changed;
  const hasTimeChanged = getHasTimeChanged(changedSaveModel.timeSettings, initialSaveModel.timeSettings);
  const hasTopLevelVariableChanges = applyVariableChangesV2(changedSaveModel, initialSaveModel, saveVariables);
  const hasSectionVariableChanges = applySectionVariableChangesV2(
    changedSaveModel.layout,
    initialSaveModel.layout,
    saveVariables
  );
  const hasVariableValueChanges = hasTopLevelVariableChanges || hasSectionVariableChanges;
  const hasRefreshChanged = changedSaveModel.timeSettings.autoRefresh !== initialSaveModel.timeSettings.autoRefresh;

  if (!saveTimeRange) {
    changedSaveModel.timeSettings.from = initialSaveModel.timeSettings.from;
    changedSaveModel.timeSettings.to = initialSaveModel.timeSettings.to;
  }

  if (!saveRefresh) {
    changedSaveModel.timeSettings.autoRefresh = initialSaveModel.timeSettings.autoRefresh;
  }

  // Calculate differences using the non-transformed to v2 spec values to be able to compare the initial and changed dashboard values
  const diff = jsonDiff(initial, changedSaveModel);
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
    hasMigratedToV2: !isDashboardV2Spec(initial),
  };
}

function convertToV2SpecIfNeeded(initial: DashboardV2Spec | Dashboard): DashboardV2Spec {
  if (isDashboardV2Spec(initial)) {
    return initial;
  }

  const dto: DashboardDTO = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    dashboard: initial as DashboardDataDTO,
    meta: {},
  };
  return ResponseTransformers.ensureV2Response(dto).spec;
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

function escapeCsvValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function customVariableQueryWithCurrent(variable: CustomVariableKind): string | undefined {
  const current = variable.spec.current;
  if (!current) {
    return undefined;
  }

  const currentValues = (Array.isArray(current.value) ? current.value : [current.value]).map((v) => String(v));
  const currentTexts = (Array.isArray(current.text) ? current.text : [current.text]).map((t) => String(t));

  if (variable.spec.valuesFormat === 'json') {
    let existingOptions: Array<{ value: string; text: string }> = [];
    if (variable.spec.query) {
      try {
        const parsed = JSON.parse(variable.spec.query);
        if (Array.isArray(parsed)) {
          existingOptions = parsed.filter(isObjectRecord).map((o) => ({
            value: String(o.value ?? ''),
            text: String(o.text ?? o.value ?? ''),
          }));
        }
      } catch {
        existingOptions = [];
      }
    }

    const existingValues = new Set(existingOptions.map((o) => o.value));
    const appendedOptions = currentValues
      .map((value, i) => ({
        value,
        text: currentTexts[i] ?? value,
      }))
      .filter((option) => !existingValues.has(option.value));

    const options = [...existingOptions, ...appendedOptions];
    return JSON.stringify(options);
  }

  const existingValues = new Set(
    (variable.spec.query.match(/(?:\\,|[^,])+/g) ?? []).map((entry) => {
      const unescaped = entry.replace(/\\,/g, ',');
      const keyValueMatch = /^\s*(.+)\s:\s(.+)$/.exec(unescaped);
      return keyValueMatch ? keyValueMatch[2].trim() : unescaped.trim();
    })
  );

  const appendedValues = currentValues
    .filter((value) => !existingValues.has(value))
    .map(escapeCsvValue)
    .join(',');
  if (!variable.spec.query) {
    return appendedValues;
  }
  if (!appendedValues) {
    return variable.spec.query;
  }
  return `${variable.spec.query},${appendedValues}`;
}

export function applyVariableChangesV2(
  saveModel: DashboardV2Spec,
  originalSaveModel: DashboardV2Spec,
  saveVariables?: boolean
) {
  return applyVariableKindListChanges(saveModel.variables, originalSaveModel.variables, saveVariables);
}

function hasCurrentValueToSave(v: VariableKind) {
  return (
    v.kind === 'QueryVariable' ||
    v.kind === 'CustomVariable' ||
    v.kind === 'DatasourceVariable' ||
    v.kind === 'ConstantVariable' ||
    v.kind === 'IntervalVariable' ||
    v.kind === 'TextVariable' ||
    v.kind === 'GroupByVariable'
  );
}

function hasOptionsToSave(v: VariableKind) {
  return (
    v.kind === 'QueryVariable' ||
    v.kind === 'CustomVariable' ||
    v.kind === 'DatasourceVariable' ||
    v.kind === 'IntervalVariable' ||
    v.kind === 'GroupByVariable'
  );
}

/**
 * Shared merge/detect logic for a VariableKind[] pair.
 * Returns true when at least one variable value differs from the original.
 * When saveVariables is falsy, mutates `variablesToSave` to restore original defaults.
 */
function applyVariableKindListChanges(
  variablesToSave: VariableKind[] = [],
  originalVariables: VariableKind[] = [],
  saveVariables?: boolean
): boolean {
  let hasChanges = false;

  for (const variable of variablesToSave) {
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
      hasChanges = true;
    } else if (
      variable.kind === 'AdhocVariable' &&
      original.kind === 'AdhocVariable' &&
      !adHocVariableFiltersEqual(
        config.featureToggles.adHocFilterDefaultValues || config.featureToggles.dashboardUnifiedDrilldownControls
          ? variable.spec.filters.filter((f) => !f.origin)
          : variable.spec.filters,
        config.featureToggles.adHocFilterDefaultValues || config.featureToggles.dashboardUnifiedDrilldownControls
          ? original.spec.filters.filter((f) => !f.origin)
          : original.spec.filters
      )
    ) {
      hasChanges = true;
    }

    if (saveVariables && variable.kind === 'CustomVariable' && original.kind === 'CustomVariable') {
      // CustomVariable runtime options are derived from query, so include the saved selection in query.
      const currentAsQuery = customVariableQueryWithCurrent(variable);
      if (currentAsQuery !== undefined) {
        variable.spec.query = currentAsQuery;
      }
    }

    if (!saveVariables) {
      if (variable.kind === 'AdhocVariable' && original.kind === 'AdhocVariable') {
        if (config.featureToggles.adHocFilterDefaultValues || config.featureToggles.dashboardUnifiedDrilldownControls) {
          const originFilters = (variable.spec.filters ?? []).filter((f) => f.origin);
          const originalRuntimeFilters = (original.spec.filters ?? []).filter((f) => !f.origin);
          variable.spec.filters = [...originFilters, ...originalRuntimeFilters];
        } else {
          variable.spec.filters = original.spec.filters;
        }
      } else if (variable.kind === 'TextVariable' && original.kind === 'TextVariable') {
        variable.spec.query = original.spec.query;
      }

      if (variable.kind !== 'AdhocVariable') {
        if (hasCurrentValueToSave(variable) && hasCurrentValueToSave(original)) {
          variable.spec.current = original.spec.current;
        }
        if (hasOptionsToSave(variable) && hasOptionsToSave(original)) {
          variable.spec.options = original.spec.options;
        }
      }
    }
  }

  return hasChanges;
}

/**
 * Recursively walk RowsLayout / TabsLayout and apply variable merge/detection
 * for section variables embedded under row.spec.variables / tab.spec.variables.
 */
export function applySectionVariableChangesV2(
  changedLayout: DashboardV2Spec['layout'] | undefined,
  originalLayout: DashboardV2Spec['layout'] | undefined,
  saveVariables?: boolean
): boolean {
  if (!changedLayout || !originalLayout || changedLayout.kind !== originalLayout.kind) {
    return false;
  }

  let hasChanges = false;

  if (changedLayout.kind === 'RowsLayout' && originalLayout.kind === 'RowsLayout') {
    changedLayout.spec.rows.forEach((row, index) => {
      const originalRow = originalLayout.spec.rows[index];
      if (!originalRow) {
        return;
      }
      hasChanges =
        applyVariableKindListChanges(row.spec.variables, originalRow.spec.variables, saveVariables) || hasChanges;
      hasChanges = applySectionVariableChangesV2(row.spec.layout, originalRow.spec.layout, saveVariables) || hasChanges;
    });
  }

  if (changedLayout.kind === 'TabsLayout' && originalLayout.kind === 'TabsLayout') {
    changedLayout.spec.tabs.forEach((tab, index) => {
      const originalTab = originalLayout.spec.tabs[index];
      if (!originalTab) {
        return;
      }
      hasChanges =
        applyVariableKindListChanges(tab.spec.variables, originalTab.spec.variables, saveVariables) || hasChanges;
      hasChanges = applySectionVariableChangesV2(tab.spec.layout, originalTab.spec.layout, saveVariables) || hasChanges;
    });
  }

  return hasChanges;
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
    } else if (variable.type === 'adhoc') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const variableFilters = validateFiltersOrigin((variable as AdHocVariableModel).filters);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const originalFilters = validateFiltersOrigin((original as AdHocVariableModel).filters);

      if (
        !adHocVariableFiltersEqual(
          variableFilters?.filter((f) => !f.origin),
          originalFilters?.filter((f) => !f.origin)
        )
      ) {
        hasVariableValueChanges = true;
      }
    }

    if (!saveVariables) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const typed = variable as TypedVariableModel;

      if (typed.type === 'adhoc') {
        if (config.featureToggles.adHocFilterDefaultValues || config.featureToggles.dashboardUnifiedDrilldownControls) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const changedFilters = (typed as AdHocVariableModel).filters ?? [];
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const originalFilters = (original as AdHocVariableModel).filters ?? [];
          const originFilters = changedFilters.filter((f) => f.origin);
          const originalRuntimeFilters = originalFilters.filter((f) => !f.origin);
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (typed as AdHocVariableModel).filters = [...originFilters, ...originalRuntimeFilters];
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (typed as AdHocVariableModel).filters = (original as AdHocVariableModel).filters;
        }
      } else if (typed.type === 'textbox') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        typed.query = (original as TextBoxVariableModel).query;
      }

      if (typed.type !== 'adhoc') {
        variable.current = original.current;
        variable.options = original.options;
      }
    }
  }

  return hasVariableValueChanges;
}

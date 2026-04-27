/**
 * Runtime migration: GroupByVariable → AdHocFiltersVariable groupBy extension.
 *
 * When `dashboardUnifiedDrilldownControls` is enabled, GroupByVariable entries
 * are merged into the matching AdHocFiltersVariable (same datasource) as
 * groupBy-operator filters. The GroupByVariable is then dropped from the
 * variable list so it is never instantiated.
 *
 * Since this is a runtime layer the schema will not be persisted until the user saves the dashboard,
 * so reverting back to the old model by turning the FF off won't work without re-adding a GroupByVariable manually.
 *
 * This is a temporary compat layer — remove once GroupByVariable is fully deprecated.
 */
import type { GroupByVariableModel, TypedVariableModel } from '@grafana/data/types';
import { config } from '@grafana/runtime';
import type {
  AdhocVariableKind,
  GroupByVariableKind,
  VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

const GROUP_BY_OPERATOR = 'groupBy';

interface GroupByFilterEntry {
  key: string;
  keyLabel?: string;
  operator: typeof GROUP_BY_OPERATOR;
  value: '';
  condition: '';
  origin?: 'dashboard';
}

function toGroupByFilter(key: string, keyLabel?: string, origin?: 'dashboard'): GroupByFilterEntry {
  return {
    key,
    ...(keyLabel && keyLabel !== key ? { keyLabel } : {}),
    operator: GROUP_BY_OPERATOR,
    value: '',
    condition: '',
    ...(origin ? { origin } : {}),
  };
}

interface KeyWithLabel {
  key: string;
  label?: string;
}

function buildGroupByFilters(currentEntries: KeyWithLabel[], defaultEntries: KeyWithLabel[]): GroupByFilterEntry[] {
  const filters: GroupByFilterEntry[] = [];
  const seen = new Set<string>();

  for (const entry of defaultEntries) {
    seen.add(entry.key);
    filters.push(toGroupByFilter(entry.key, entry.label, 'dashboard'));
  }

  for (const entry of currentEntries) {
    if (!seen.has(entry.key)) {
      filters.push(toGroupByFilter(entry.key, entry.label));
    }
  }

  return filters;
}

// ---------------------------------------------------------------------------
// V1 (legacy JSON model)
// ---------------------------------------------------------------------------

/**
 * Migrates v1 `TypedVariableModel[]`: merges each GroupByVariable into its
 * datasource-matching AdHocFiltersVariable, then removes it.
 * Returns a new list (no GroupByVariables). Does not mutate the input.
 */
export function migrateGroupByVariablesV1(variables: TypedVariableModel[]): TypedVariableModel[] {
  if (!config.featureToggles.dashboardUnifiedDrilldownControls) {
    return variables;
  }

  const groupByVars = variables.filter(isGroupByModel);
  if (groupByVars.length === 0) {
    return variables;
  }

  const groupByByDsUid = new Map<string | undefined, GroupByVariableModel>();
  for (const gb of groupByVars) {
    groupByByDsUid.set(gb.datasource?.uid, gb);
  }

  const result: TypedVariableModel[] = [];

  for (const v of variables) {
    if (v.type === 'groupby') {
      continue;
    }

    if (v.type !== 'adhoc') {
      result.push(v);
      continue;
    }

    const gb = groupByByDsUid.get(v.datasource?.uid);
    if (!gb) {
      result.push(v);
      continue;
    }

    const currentEntries = extractV1Entries(gb.current);
    const defaultEntries = extractV1Entries(gb.defaultValue);
    const groupByFilters = buildGroupByFilters(currentEntries, defaultEntries);

    result.push({
      ...v,
      enableGroupBy: true,
      filters: [...(v.filters ?? []), ...groupByFilters],
    });
  }

  return result;
}

function isGroupByModel(v: TypedVariableModel): v is GroupByVariableModel {
  return v.type === 'groupby';
}

function extractV1Entries(option?: { value?: string | string[]; text?: string | string[] }): KeyWithLabel[] {
  if (!option?.value) {
    return [];
  }

  const values = Array.isArray(option.value) ? option.value.map(String) : [String(option.value)];
  const labels = Array.isArray(option.text) ? option.text.map(String) : option.text ? [String(option.text)] : [];

  return values.filter(Boolean).map((val, i) => ({
    key: val,
    label: labels[i] || undefined,
  }));
}

// ---------------------------------------------------------------------------
// V2 (schema v2 kinds)
// ---------------------------------------------------------------------------

/**
 * Migrates v2 `VariableKind[]`: merges each GroupByVariableKind into its
 * datasource-matching AdhocVariableKind, then removes it.
 * Returns a new list (no GroupByVariableKinds). Does not mutate the input.
 */
export function migrateGroupByVariablesV2(variables: VariableKind[]): VariableKind[] {
  if (!config.featureToggles.dashboardUnifiedDrilldownControls) {
    return variables;
  }

  const groupByVars = variables.filter((v): v is GroupByVariableKind => v.kind === 'GroupByVariable');
  if (groupByVars.length === 0) {
    return variables;
  }

  const groupByByDsName = new Map<string | undefined, GroupByVariableKind>();
  for (const gb of groupByVars) {
    groupByByDsName.set(gb.datasource?.name, gb);
  }

  const result: VariableKind[] = [];

  for (const v of variables) {
    if (v.kind === 'GroupByVariable') {
      continue;
    }

    if (v.kind !== 'AdhocVariable') {
      result.push(v);
      continue;
    }

    const gb = groupByByDsName.get(v.datasource?.name);
    if (!gb) {
      result.push(v);
      continue;
    }

    const currentEntries = extractV2Entries(gb.spec.current);
    const defaultEntries = extractV2Entries(gb.spec.defaultValue);
    const groupByFilters = buildGroupByFilters(currentEntries, defaultEntries);

    const migrated: AdhocVariableKind = {
      ...v,
      spec: {
        ...v.spec,
        enableGroupBy: true,
        filters: [...(v.spec.filters ?? []), ...groupByFilters],
      },
    };
    result.push(migrated);
  }

  return result;
}

function extractV2Entries(option?: { value?: string | string[]; text?: string | string[] }): KeyWithLabel[] {
  if (!option?.value) {
    return [];
  }

  const values = Array.isArray(option.value) ? option.value.map(String) : [String(option.value)];
  const labels = Array.isArray(option.text) ? option.text.map(String) : option.text ? [String(option.text)] : [];

  return values.filter(Boolean).map((val, i) => ({
    key: val,
    label: labels[i] || undefined,
  }));
}

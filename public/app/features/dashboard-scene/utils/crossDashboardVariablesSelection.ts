import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { getPredefinedOrigin } from './predefinedVariables';

export type PredefinedVariableResolutionInput = {
  annotations?: Record<string, string | undefined> | null;
};

export type ScopeSelection = 'all' | 'none' | string[];

export type UseCrossDashboardVariables = {
  global: ScopeSelection;
  folder: ScopeSelection;
};

/** Coarse injection mode for load analytics and save-diff labels. */
export type GlobalVariablesMode = 'none' | 'all' | 'global' | 'folder';

export type PredefinedVariableScope = 'global' | 'folder';

/**
 * Map a persisted selection to a coarse mode.
 *
 * - Missing annotation (`undefined`) → `none` (not opted in)
 * - Both scopes `"none"` → `none`
 * - Both scopes `"all"` → `all`
 * - Global `"all"` + folder `"none"` → `global`
 * - Global `"none"` + folder `"all"` → `folder`
 * - Name lists or mixed combinations → `undefined` (not a coarse All/None/scope label)
 */
export function getGlobalVariablesMode(
  selection: UseCrossDashboardVariables | undefined
): GlobalVariablesMode | undefined {
  if (selection === undefined) {
    return 'none';
  }

  const global = normalizeScopeSelection(selection.global);
  const folder = normalizeScopeSelection(selection.folder);

  if (global === 'none' && folder === 'none') {
    return 'none';
  }
  if (global === 'all' && folder === 'all') {
    return 'all';
  }
  if (global === 'all' && folder === 'none') {
    return 'global';
  }
  if (global === 'none' && folder === 'all') {
    return 'folder';
  }
  return undefined;
}

/** Count injected variables by predefined origin for load analytics. */
export function countPredefinedVariableOrigins(variables: VariableKind[]): {
  global_count: number;
  folder_count: number;
  total_count: number;
} {
  let global_count = 0;
  let folder_count = 0;
  for (const variable of variables) {
    const origin = getPredefinedOrigin(variable.spec.origin);
    if (origin?.type === 'global') {
      global_count += 1;
    } else if (origin?.type === 'folder') {
      folder_count += 1;
    }
  }
  return { global_count, folder_count, total_count: global_count + folder_count };
}

/**
 * Parse `grafana.app/useCrossDashboardVariables`.
 *
 * - Missing / empty annotation → `undefined` (not opted in; inject none)
 * - Present but invalid JSON / non-object / invalid field → `undefined`
 * - Missing scope field → `"none"` for that scope
 * - Empty name array → `"none"`
 */
export function parseUseCrossDashboardVariables(
  annotations?: Record<string, string | undefined> | null
): UseCrossDashboardVariables | undefined {
  const raw = annotations?.[AnnoKeyUseCrossDashboardVariables];
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) {
      return undefined;
    }

    const global = parseScopeSelection(parsed.global);
    const folder = parseScopeSelection(parsed.folder);
    if (global === undefined || folder === undefined) {
      return undefined;
    }

    return { global, folder };
  } catch {
    return undefined;
  }
}

/**
 * Serialize a selection. Both scopes `"none"` (including empty arrays) omit the annotation.
 */
export function serializeUseCrossDashboardVariables(selection: UseCrossDashboardVariables): string | undefined {
  const global = normalizeScopeSelection(selection.global);
  const folder = normalizeScopeSelection(selection.folder);
  if (global === 'none' && folder === 'none') {
    return undefined;
  }
  return JSON.stringify({ global, folder });
}

/** Write or delete the annotation on a mutable annotation map. */
export function writeUseCrossDashboardVariables(
  annotations: Record<string, string>,
  selection: UseCrossDashboardVariables
): void {
  // Stop re-persisting the unread denylist this annotation replaced.
  delete annotations['grafana.app/ignorePredefinedVariables'];

  const serialized = serializeUseCrossDashboardVariables(selection);
  if (serialized === undefined) {
    delete annotations[AnnoKeyUseCrossDashboardVariables];
  } else {
    annotations[AnnoKeyUseCrossDashboardVariables] = serialized;
  }
}

export function isScopeNameSelected(scope: ScopeSelection, name: string): boolean {
  if (scope === 'all') {
    return true;
  }
  if (scope === 'none') {
    return false;
  }
  return scope.includes(name);
}

/**
 * Toggle one name in a scope. Checking stays a name array — `"all"` is only written by
 * the All checkbox (`setScopeAll`). Unchecking from `"all"` writes the remaining names.
 */
export function toggleScopeName(
  scope: ScopeSelection,
  name: string,
  checked: boolean,
  allNamesInScope: string[]
): ScopeSelection {
  if (checked) {
    if (scope === 'all') {
      return 'all';
    }
    const names = scope === 'none' ? [] : [...scope];
    if (!names.includes(name)) {
      names.push(name);
    }
    return names.length === 0 ? 'none' : names;
  }

  const names = scope === 'all' ? [...allNamesInScope] : scope === 'none' ? [] : [...scope];
  const next = names.filter((n) => n !== name);
  return next.length === 0 ? 'none' : next;
}

/** Write `"all"` or `"none"` for a scope (All checkbox). */
export function setScopeAll(checked: boolean): ScopeSelection {
  return checked ? 'all' : 'none';
}

/**
 * Apply a per-name checkbox to the full selection.
 *
 * Unchecking drops the name from both scopes so a folder variable that shadowed a
 * selected global does not stay opted in via the leftover global name.
 */
export function toggleSelectionName(
  selection: UseCrossDashboardVariables,
  scope: PredefinedVariableScope,
  name: string,
  checked: boolean,
  allNamesInScope: string[]
): UseCrossDashboardVariables {
  if (checked) {
    return {
      ...selection,
      [scope]: toggleScopeName(selection[scope], name, true, allNamesInScope),
    };
  }

  return {
    global:
      scope === 'global'
        ? toggleScopeName(selection.global, name, false, allNamesInScope)
        : dropListedName(selection.global, name),
    folder:
      scope === 'folder'
        ? toggleScopeName(selection.folder, name, false, allNamesInScope)
        : dropListedName(selection.folder, name),
  };
}

/**
 * Whether a variable listed under `scope` is opted in.
 *
 * A name-array selection in the other scope still counts, so a folder variable
 * that shadowed a selected global keeps the explicit opt-in.
 */
export function isPredefinedNameSelected(
  selection: UseCrossDashboardVariables | undefined,
  scope: PredefinedVariableScope,
  name: string
): boolean {
  if (!selection) {
    return false;
  }
  if (isScopeNameSelected(selection[scope], name)) {
    return true;
  }
  const other = scope === 'global' ? selection.folder : selection.global;
  return Array.isArray(other) && other.includes(name);
}

export function applyUseCrossDashboardVariables(
  variables: VariableKind[],
  selection: UseCrossDashboardVariables
): VariableKind[] {
  return variables.filter((variable) => {
    const origin = getPredefinedOrigin(variable.spec.origin);
    if (!origin) {
      return true;
    }
    if (origin.type === 'global' || origin.type === 'folder') {
      return isPredefinedNameSelected(selection, origin.type, variable.spec.name);
    }
    return true;
  });
}

function dropListedName(scope: ScopeSelection, name: string): ScopeSelection {
  if (scope === 'all' || scope === 'none') {
    return scope;
  }
  const next = scope.filter((n) => n !== name);
  return next.length === 0 ? 'none' : next;
}

/**
 * Resolve which predefined variables to inject for a dashboard.
 *
 * Absent / invalid annotation → inject none (not opted in).
 */
export function resolvePredefinedVariablesForDashboard(
  variables: VariableKind[],
  input: PredefinedVariableResolutionInput
): VariableKind[] {
  const selection = parseUseCrossDashboardVariables(input.annotations);
  if (selection === undefined) {
    return [];
  }
  return applyUseCrossDashboardVariables(variables, selection);
}

/**
 * Whether any predefined origin could be injected under the current policy.
 * Used to skip the Variable list fetch when nothing would be kept.
 */
export function mayInjectAnyPredefinedVariables(input: PredefinedVariableResolutionInput): boolean {
  const selection = parseUseCrossDashboardVariables(input.annotations);
  if (selection === undefined) {
    return false;
  }
  return mayInjectScope(selection.global) || mayInjectScope(selection.folder);
}

function mayInjectScope(scope: ScopeSelection): boolean {
  if (scope === 'all') {
    return true;
  }
  if (scope === 'none') {
    return false;
  }
  return scope.length > 0;
}

function parseScopeSelection(value: unknown): ScopeSelection | undefined {
  if (value === undefined) {
    return 'none';
  }
  if (value === 'all' || value === 'none') {
    return value;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const names: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      return undefined;
    }
    names.push(entry);
  }
  return names.length === 0 ? 'none' : names;
}

function normalizeScopeSelection(scope: ScopeSelection): ScopeSelection {
  if (scope === 'all' || scope === 'none') {
    return scope;
  }
  return scope.length === 0 ? 'none' : [...scope].sort();
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

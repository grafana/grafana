import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  AnnoKeyIgnorePredefinedVariables,
  DENY_ALL_FOLDER_PREDEFINED,
  DENY_ALL_GLOBAL_PREDEFINED,
  DENY_ALL_PREDEFINED,
} from 'app/features/apiserver/types';

import { getPredefinedOrigin } from './predefinedVariables';

export type PredefinedVariableResolutionInput = {
  annotations?: Record<string, string | undefined> | null;
};

/** Coarse injection mode for analytics and the sidebar radio. */
export type GlobalVariablesMode = 'none' | 'all' | 'global' | 'folder';

/**
 * Map a deny list to the coarse mode used by the sidebar radio and load analytics.
 *
 * - Missing / empty → `all`
 * - `*` → `none`
 * - `folder:*` only → `global` (keep globals)
 * - `global:*` only → `folder` (keep folder)
 * - Name-level / mixed denylists → `undefined` (no radio selected; per-name UI is not shipped yet)
 */
export function getGlobalVariablesMode(denyList: string[] | undefined): GlobalVariablesMode | undefined {
  if (denyList === undefined || denyList.length === 0) {
    return 'all';
  }
  if (denyList.includes(DENY_ALL_PREDEFINED)) {
    return 'none';
  }
  // Mode names the bucket to KEEP, so folder:* deny → Global and global:* deny → Folder.
  if (denyList.length === 1 && denyList[0] === DENY_ALL_FOLDER_PREDEFINED) {
    return 'global';
  }
  if (denyList.length === 1 && denyList[0] === DENY_ALL_GLOBAL_PREDEFINED) {
    return 'folder';
  }
  return undefined;
}

export function denyListFromGlobalVariablesMode(mode: GlobalVariablesMode): string[] | undefined {
  switch (mode) {
    case 'all':
      return undefined;
    case 'none':
      return [DENY_ALL_PREDEFINED];
    // Mode names the bucket to KEEP, so we deny the *other* bucket.
    case 'global':
      return [DENY_ALL_FOLDER_PREDEFINED];
    case 'folder':
      return [DENY_ALL_GLOBAL_PREDEFINED];
  }
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
 * Parse the dashboard ignore/deny annotation.
 *
 * - Missing / empty annotation → `undefined` (opted out; inject none)
 * - Present but invalid JSON / non-string-array → `undefined` (same as absent)
 * - Valid JSON array of strings → that deny list (`[]` means inject all)
 */
export function parseIgnorePredefinedVariables(
  annotations?: Record<string, string | undefined> | null
): string[] | undefined {
  const raw = annotations?.[AnnoKeyIgnorePredefinedVariables];
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    const names: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'string') {
        return undefined;
      }
      names.push(entry);
    }
    return names;
  } catch {
    return undefined;
  }
}

export function serializeIgnorePredefinedVariables(denyList: string[]): string {
  return JSON.stringify(denyList);
}

/**
 * Filter predefined variables by a deny list (sentinels + exact names).
 */
export function applyPredefinedVariableDenyList(variables: VariableKind[], denyList: string[]): VariableKind[] {
  const deny = new Set(denyList);

  if (deny.has(DENY_ALL_PREDEFINED)) {
    return [];
  }

  return variables.filter((variable) => {
    const origin = getPredefinedOrigin(variable.spec.origin);
    if (!origin) {
      return true;
    }
    if (origin.type === 'global' && deny.has(DENY_ALL_GLOBAL_PREDEFINED)) {
      return false;
    }
    if (origin.type === 'folder' && deny.has(DENY_ALL_FOLDER_PREDEFINED)) {
      return false;
    }
    return !deny.has(variable.spec.name);
  });
}

/**
 * Resolve which predefined variables to inject for a dashboard.
 *
 * Absent / invalid annotation → inject none (opt-out by default).
 * Empty deny list (`[]`) → inject all (explicit opt-in).
 * Otherwise apply the deny filter.
 */
export function resolvePredefinedVariablesForDashboard(
  variables: VariableKind[],
  input: PredefinedVariableResolutionInput
): VariableKind[] {
  const denyList = parseIgnorePredefinedVariables(input.annotations);
  if (denyList === undefined) {
    return [];
  }
  if (denyList.length === 0) {
    return variables;
  }
  return applyPredefinedVariableDenyList(variables, denyList);
}

/**
 * Whether any predefined origin could be injected under the current policy.
 * Used to skip the Variable list fetch when nothing would be kept.
 */
export function mayInjectAnyPredefinedVariables(input: PredefinedVariableResolutionInput): boolean {
  const denyList = parseIgnorePredefinedVariables(input.annotations);
  if (denyList === undefined) {
    return false;
  }
  if (denyList.length === 0) {
    return true;
  }
  return !denyList.includes(DENY_ALL_PREDEFINED);
}

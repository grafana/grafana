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

/**
 * Parse the dashboard ignore/deny annotation.
 *
 * - Missing / empty annotation → `undefined` (inject all; fail-open default)
 * - Present but invalid JSON / non-string-array → `undefined` (fail open)
 * - Valid JSON array of strings → that deny list
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
 * Absent or empty deny list → inject all. Otherwise apply the deny filter.
 */
export function resolvePredefinedVariablesForDashboard(
  variables: VariableKind[],
  input: PredefinedVariableResolutionInput
): VariableKind[] {
  const denyList = parseIgnorePredefinedVariables(input.annotations);
  if (denyList === undefined || denyList.length === 0) {
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
  if (denyList === undefined || denyList.length === 0) {
    return true;
  }
  return !denyList.includes(DENY_ALL_PREDEFINED);
}

import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  ALLOW_ALL_FOLDER_PREDEFINED,
  ALLOW_ALL_GLOBAL_PREDEFINED,
  ALLOW_ALL_PREDEFINED,
  AnnoKeyUsePredefinedVariables,
} from 'app/features/apiserver/types';

import { getPredefinedOrigin } from './predefinedVariables';

export type UsePredefinedVariablesConfig = {
  /**
   * Entries to include from injection.
   *
   * Wire may use the shorthand string `"*"` (normalize to `["*"]` when parsing).
   *
   * Sentinels:
   * - `"*"` — allow all predefined (global + folder)
   * - `"global:*"` — allow all with origin.type === 'global'
   * - `"folder:*"` — allow all with origin.type === 'folder'
   *
   * Anything else — exact variable name (matches either origin).
   *
   * `[]` — allow none (explicit opt-out)
   */
  predefinedVariablesAllowList: '*' | string[];
};

export type PredefinedVariableResolutionInput = {
  annotations?: Record<string, string | undefined> | null;
};

/**
 * Parse the dashboard allowlist annotation.
 *
 * - Missing annotation → `undefined` (no injection; dashboard has not opted in)
 * - Present but invalid JSON / wrong shape → empty allowlist (deny-all)
 */
export function parseUsePredefinedVariables(
  annotations?: Record<string, string | undefined> | null
): UsePredefinedVariablesConfig | undefined {
  const raw = annotations?.[AnnoKeyUsePredefinedVariables];
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { predefinedVariablesAllowList: [] };
    }

    const list = Reflect.get(parsed, 'predefinedVariablesAllowList');
    if (list === ALLOW_ALL_PREDEFINED) {
      return { predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED };
    }
    if (!Array.isArray(list)) {
      return { predefinedVariablesAllowList: [] };
    }
    const names: string[] = [];
    for (const entry of list) {
      if (typeof entry !== 'string') {
        return { predefinedVariablesAllowList: [] };
      }
      names.push(entry);
    }

    return { predefinedVariablesAllowList: names };
  } catch {
    return { predefinedVariablesAllowList: [] };
  }
}

export function serializeUsePredefinedVariables(config: UsePredefinedVariablesConfig): string {
  return JSON.stringify({
    predefinedVariablesAllowList: config.predefinedVariablesAllowList,
  });
}

/** Build the allow-all annotation value stamped on new dashboards. */
export function allowAllPredefinedVariablesAnnotationValue(): string {
  return serializeUsePredefinedVariables({ predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED });
}

function normalizeAllowList(list: '*' | string[]): string[] {
  if (list === ALLOW_ALL_PREDEFINED) {
    return [ALLOW_ALL_PREDEFINED];
  }
  return list;
}

/**
 * Filter predefined variables by an explicit allowlist (dashboard annotation present).
 */
export function applyPredefinedVariableAllowList(
  variables: VariableKind[],
  config: UsePredefinedVariablesConfig
): VariableKind[] {
  const allow = new Set(normalizeAllowList(config.predefinedVariablesAllowList));

  if (allow.has(ALLOW_ALL_PREDEFINED)) {
    return variables;
  }

  return variables.filter((variable) => {
    const origin = getPredefinedOrigin(variable.spec.origin);
    if (!origin) {
      return false;
    }
    if (origin.type === 'global' && allow.has(ALLOW_ALL_GLOBAL_PREDEFINED)) {
      return true;
    }
    if (origin.type === 'folder' && allow.has(ALLOW_ALL_FOLDER_PREDEFINED)) {
      return true;
    }
    return allow.has(variable.spec.name);
  });
}

/**
 * Resolve which predefined variables to inject for a dashboard.
 *
 * Dashboard allowlist (when present) is authoritative, including `[]` opt-out.
 * When absent, nothing is injected (opt-in only).
 */
export function resolvePredefinedVariablesForDashboard(
  variables: VariableKind[],
  input: PredefinedVariableResolutionInput
): VariableKind[] {
  const allowlist = parseUsePredefinedVariables(input.annotations);
  if (allowlist === undefined) {
    return [];
  }
  return applyPredefinedVariableAllowList(variables, allowlist);
}

/**
 * Whether any predefined origin could be injected under the current policy.
 * Used to skip the Variable list fetch when nothing would be kept.
 */
export function mayInjectAnyPredefinedVariables(input: PredefinedVariableResolutionInput): boolean {
  const allowlist = parseUsePredefinedVariables(input.annotations);
  if (allowlist === undefined) {
    return false;
  }
  return normalizeAllowList(allowlist.predefinedVariablesAllowList).length > 0;
}

import { cloneDeep, get, set, unset } from 'lodash';

import { createTheme, type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';

export type ThemeFieldKind = 'color' | 'number' | 'text';

export interface ThemeFieldDef {
  /** lodash path into NewThemeOptions. */
  path: string;
  label: string;
  kind: ThemeFieldKind;
  /**
   * Path into the derived GrafanaTheme2 used to show the effective value when there is no override.
   * Defaults to `path` when the input and derived shapes line up.
   */
  derivedPath?: string;
}

/** Deep clone a theme options object so edits never mutate the shared base definitions. */
export function cloneThemeOptions(options: NewThemeOptions): NewThemeOptions {
  return cloneDeep(options);
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * The value shown for a field: an explicit override in the options if present, otherwise the value
 * derived by createTheme so every input reflects the effective theme.
 */
export function getFieldValue(
  options: NewThemeOptions,
  derived: GrafanaTheme2,
  field: ThemeFieldDef
): string | number | undefined {
  const override = get(options, field.path);
  const value = override ?? get(derived, field.derivedPath ?? field.path);
  return field.kind === 'number' ? coerceNumber(value) : value;
}

/** Return new options with the value at path set, or the override removed when cleared. */
export function setFieldValue(
  options: NewThemeOptions,
  path: string,
  value: string | number | undefined
): NewThemeOptions {
  const next = cloneDeep(options);
  if (value === undefined || value === '') {
    unset(next, path);
  } else {
    set(next, path, value);
  }
  return next;
}

/** Rebuild the derived theme from options, tolerating transient invalid states. */
export function buildPreviewTheme(options: NewThemeOptions, fallback: GrafanaTheme2): GrafanaTheme2 {
  try {
    return createTheme(options);
  } catch {
    return fallback;
  }
}

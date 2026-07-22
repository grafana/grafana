import { cloneDeep, get, set, unset } from 'lodash';

import { createTheme, type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';

export type ThemeFieldKind = 'color' | 'number' | 'text';

export interface ThemeFieldDef {
  path: string;
  label: string;
  kind: ThemeFieldKind;
  /** Path into the derived theme for the effective value; defaults to `path`. */
  derivedPath?: string;
}

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

/** An explicit override if present, otherwise the value from the derived theme. */
export function getFieldValue(
  options: NewThemeOptions,
  derived: GrafanaTheme2,
  field: ThemeFieldDef
): string | number | undefined {
  const override = get(options, field.path);
  const value = override ?? get(derived, field.derivedPath ?? field.path);
  return field.kind === 'number' ? coerceNumber(value) : value;
}

/** Set the value at path, or remove the override when cleared. */
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

/** Build the theme from options, falling back while edits are transiently invalid. */
export function buildPreviewTheme(options: NewThemeOptions, fallback: GrafanaTheme2): GrafanaTheme2 {
  try {
    return createTheme(options);
  } catch {
    return fallback;
  }
}

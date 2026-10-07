import { type RuleLabel } from 'app/features/alerting/unified/api/prometheusApi';

import { ALL_TEAMS } from './teamFilter';

export const ALERTS_FILTER_STORAGE_KEY = 'grafana.home.alerts.filter';

/**
 * The homepage alerts filter selection: '' for the default scope ("your teams" for team members,
 * everything otherwise), ALL_TEAMS for an explicit org-wide pick, otherwise `key:value` naming one
 * alert rule label (e.g. `team:platform`, `severity:critical`).
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type AlertFilterSelection = string;

/** What a selection filters alerts by, read once so the list and its empty message agree. */
export type AlertFilterScope = { kind: 'default' } | { kind: 'all' } | { kind: 'label'; label: RuleLabel };

// The first ':' separates key from value, so a key holding one can't be read back.
const FILTER_SEPARATOR = ':';

/** Whether a label can be stored as a selection and read back unchanged. */
export function canEncodeAlertFilter({ key }: RuleLabel): boolean {
  return !key.includes(FILTER_SEPARATOR);
}

export function encodeAlertFilter({ key, value }: RuleLabel): AlertFilterSelection {
  return `${key}${FILTER_SEPARATOR}${value}`;
}

function decodeAlertFilter(selection: AlertFilterSelection): RuleLabel | undefined {
  const separatorIndex = selection.indexOf(FILTER_SEPARATOR);
  if (separatorIndex <= 0) {
    return undefined;
  }
  return { key: selection.slice(0, separatorIndex), value: selection.slice(separatorIndex + 1) };
}

/** A stored value that names no label, e.g. one edited by hand, falls back to the default scope. */
export function resolveAlertFilter(selection: AlertFilterSelection): AlertFilterScope {
  if (selection === ALL_TEAMS) {
    return { kind: 'all' };
  }
  const label = decodeAlertFilter(selection);
  return label ? { kind: 'label', label } : { kind: 'default' };
}

/** What to show for a selection: the picked value, never the raw `key:value` encoding. */
export function alertFilterLabel(selection: AlertFilterSelection): string {
  return decodeAlertFilter(selection)?.value ?? selection;
}

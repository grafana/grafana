import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

/** Sentinel for an explicit "All" pick; never a real option value. */
export const ALL_TEAMS = ALL_VARIABLE_VALUE;

/** One label value a homepage filter can pick, e.g. `team` = `platform`. */
interface FilterLabel {
  key: string;
  value: string;
}

/** What a selection filters by. Parsed in one place so the list, its empty message and the dropdown agree. */
export type FilterScope = { kind: 'default' } | { kind: 'all' } | { kind: 'label'; label: FilterLabel };

// The first ':' separates key from value, so a key holding one can't be read back.
const FILTER_SEPARATOR = ':';

/** Whether a label can be stored as a selection and read back unchanged. */
export function canEncodeFilterLabel({ key }: FilterLabel): boolean {
  return !key.includes(FILTER_SEPARATOR);
}

export function encodeFilterLabel({ key, value }: FilterLabel): string {
  return `${key}${FILTER_SEPARATOR}${value}`;
}

/**
 * A picked label as the empty messages name it, e.g. `severity=critical`. The key has to
 * show there, since a value like `critical` alone could belong to any label.
 */
export function formatFilterLabel({ key, value }: FilterLabel): string {
  return `${key}=${value}`;
}

/**
 * The scope a homepage filter selection names: '' is the default ("your teams" for team members,
 * everything otherwise), ALL_TEAMS an explicit org-wide pick, and `key:value` one picked label.
 * A stored value that names no label, e.g. one edited by hand, falls back to the default.
 */
export function resolveFilterScope(selection: string): FilterScope {
  if (selection === ALL_TEAMS) {
    return { kind: 'all' };
  }
  const separatorIndex = selection.indexOf(FILTER_SEPARATOR);
  if (separatorIndex <= 0) {
    return { kind: 'default' };
  }
  return {
    kind: 'label',
    label: { key: selection.slice(0, separatorIndex), value: selection.slice(separatorIndex + 1) },
  };
}

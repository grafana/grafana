// Same string as when the filter was team-only, so stored selections survive the widening.
export const INCIDENTS_FILTER_STORAGE_KEY = 'grafana.home.incidents.teamFilter';

/**
 * The homepage incidents filter selection: '' for every active incident, otherwise
 * `slug:value` naming one select-field value (e.g. `team:Platform`, `squad:Frontend`).
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type IncidentFilterSelection = string;

/** One custom-field value an incident filter selection names. */
export interface IncidentFilterValue {
  slug: string;
  value: string;
}

// Field slugs are identifiers, so the first ':' always separates slug from value.
const FILTER_SEPARATOR = ':';
const LEGACY_FILTER_SLUG = 'team';

export function encodeIncidentFilter({ slug, value }: IncidentFilterValue): IncidentFilterSelection {
  return `${slug}${FILTER_SEPARATOR}${value}`;
}

/** The field value the user picked, or undefined for the default (unfiltered) scope. */
export function decodeIncidentFilter(selection: IncidentFilterSelection): IncidentFilterValue | undefined {
  if (!selection) {
    return undefined;
  }
  const separatorIndex = selection.indexOf(FILTER_SEPARATOR);
  // A stored selection from before the filter carried a slug is a bare `team` value.
  if (separatorIndex <= 0) {
    return { slug: LEGACY_FILTER_SLUG, value: selection };
  }
  return { slug: selection.slice(0, separatorIndex), value: selection.slice(separatorIndex + 1) };
}

/** Re-encodes a stored selection so a legacy bare team value matches its live `team:value` option. */
export function canonicalIncidentFilter(selection: IncidentFilterSelection): IncidentFilterSelection {
  const filter = decodeIncidentFilter(selection);
  return filter ? encodeIncidentFilter(filter) : '';
}

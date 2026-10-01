import { type IncidentFieldFilter } from 'app/features/alerting/unified/api/incidentsApi';

export const INCIDENTS_FILTER_STORAGE_KEY = 'grafana.home.incidents.filter';

/**
 * The homepage incidents filter selection: '' for every active incident, otherwise
 * `slug:value` naming one label value (e.g. `team:Platform`, `squad:Frontend`).
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type IncidentFilterSelection = string;

// Field slugs are identifiers, so the first ':' always separates slug from value.
const FILTER_SEPARATOR = ':';

export function encodeIncidentFilter({ slug, value }: IncidentFieldFilter): IncidentFilterSelection {
  return `${slug}${FILTER_SEPARATOR}${value}`;
}

/** The field value the user picked, or undefined for the default (unfiltered) scope. */
export function decodeIncidentFilter(selection: IncidentFilterSelection): IncidentFieldFilter | undefined {
  const separatorIndex = selection.indexOf(FILTER_SEPARATOR);
  if (separatorIndex <= 0) {
    return undefined;
  }
  return { slug: selection.slice(0, separatorIndex), value: selection.slice(separatorIndex + 1) };
}

/** What to show for a selection: the picked value, never the raw `slug:value` encoding. */
export function incidentFilterLabel(selection: IncidentFilterSelection): string {
  return decodeIncidentFilter(selection)?.value ?? selection;
}

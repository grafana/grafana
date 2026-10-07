import { type IncidentFieldFilter } from 'app/features/alerting/unified/api/incidentsApi';

import { encodeFilterLabel, resolveFilterScope } from './teamFilter';

export const INCIDENTS_FILTER_STORAGE_KEY = 'grafana.home.incidents.filter';

/**
 * The homepage incidents filter selection: '' for every active incident, otherwise
 * `slug:value` naming one label value (e.g. `team:Platform`, `squad:Frontend`).
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type IncidentFilterSelection = string;

// Field slugs are identifiers, so the first ':' always separates slug from value.
export function encodeIncidentFilter({ slug, value }: IncidentFieldFilter): IncidentFilterSelection {
  return encodeFilterLabel({ key: slug, value });
}

/** The field value the user picked, or undefined for the default (unfiltered) scope. */
export function decodeIncidentFilter(selection: IncidentFilterSelection): IncidentFieldFilter | undefined {
  const scope = resolveFilterScope(selection);
  return scope.kind === 'label' ? { slug: scope.label.key, value: scope.label.value } : undefined;
}

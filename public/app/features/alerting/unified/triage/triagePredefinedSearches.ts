/**
 * Pre-defined saved searches for the Alert Activity (Triage) page.
 *
 * These appear in the Saved searches dropdown when alertingTriageSavedSearches
 * is enabled. Users can rename, delete, and set default on them like their own
 * saves; renames and dismissals are persisted via useTriagePredefinedOverrides.
 * Stable IDs allow the app to identify predefined items for that behaviour.
 */

import { t } from '@grafana/i18n';

import { type SavedSearch } from '../components/saved-searches/savedSearchesSchema';

import { buildTriageQueryStringFromParts } from './scene/triageSavedSearchUtils';
import { defaultTimeRange } from './scene/utils';

/** Prefix for predefined search IDs; used to identify predefined items for overrides and dismissed handling. */
export const TRIAGE_PREDEFINED_SEARCH_ID_PREFIX = 'triage-predefined-';

const PREDEFINED_IDS = [
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-firing`,
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}firing-only`,
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-only`,
] as const;

/** Predefined search used as default when the user has not set a default (grouped by folder). */
export const TRIAGE_DEFAULT_PREDEFINED_SEARCH_ID = PREDEFINED_IDS[0];

/**
 * Pre-defined triage saved searches for common scenarios.
 * Uses default time range from scene/utils (15m).
 * Order defines display order in the dropdown (before user saves).
 * Must be called from a component or function so t() is not used at top level.
 */
export function getTriagePredefinedSearches(): SavedSearch[] {
  return [
    {
      id: PREDEFINED_IDS[0],
      name: t('alerting.triage.saved-searches.predefined.folder-firing', 'Show only firing, grouped by folder'),
      isDefault: true,
      query: buildTriageQueryStringFromParts({
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
        groupBy: ['grafana_folder'],
        timeRange: defaultTimeRange,
      }),
    },
    {
      id: PREDEFINED_IDS[1],
      name: t('alerting.triage.saved-searches.predefined.firing-only', 'Show only firing'),
      isDefault: false,
      query: buildTriageQueryStringFromParts({
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
        groupBy: [],
        timeRange: defaultTimeRange,
      }),
    },
    {
      id: PREDEFINED_IDS[2],
      name: t('alerting.triage.saved-searches.predefined.folder-only', 'Grouped by folder'),
      isDefault: false,
      query: buildTriageQueryStringFromParts({
        groupBy: ['grafana_folder'],
        timeRange: defaultTimeRange,
      }),
    },
  ];
}

/**
 * Returns true if the given saved search ID is a predefined search.
 */
export function isTriagePredefinedSearchId(id: string): boolean {
  return id.startsWith(TRIAGE_PREDEFINED_SEARCH_ID_PREFIX);
}

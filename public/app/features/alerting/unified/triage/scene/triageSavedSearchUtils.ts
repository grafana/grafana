/**
 * Utility functions for serializing and applying saved searches on the Triage page.
 *
 * These functions handle the conversion between URL parameters and saved search
 * query strings, preserving filters, groupBy selections, and time range.
 *
 * GroupBy keys are stored as entries in the same `var-filters` URL parameter using the
 * `key|groupBy` 2-part format defined by Scenes' AdHocFiltersVariable URL sync handler.
 */

import { type RawTimeRange, dateMath, makeTimeRange } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GROUP_BY_OPERATOR,
  type SceneObject,
  escapeURLDelimiters,
  sceneGraph,
} from '@grafana/scenes';

import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { TRIAGE_STATE_URL_PARAMS, URL_PARAMS, VARIABLES } from '../constants';

const SAVED_SEARCH_VERSION_PARAM = 'savedSearchVersion';
const SCENES_SAVED_SEARCH_VERSION = '2';

/**
 * Merges predefined and user saved searches, with the default search first.
 *
 * @param predefinedSearches - Predefined searches (with isDefault applied)
 * @param userSavedSearches - User-created saved searches (with isDefault applied)
 * @param defaultId - ID of the search set as default, or null
 * @returns Merged list with default item first, then predefined, then user
 */
export function mergeTriageSavedSearches(
  predefinedSearches: SavedSearch[],
  userSavedSearches: SavedSearch[],
  defaultId: string | null
): SavedSearch[] {
  const merged = [...predefinedSearches, ...userSavedSearches];
  const defaultIndex = merged.findIndex((s) => s.id === defaultId);
  if (defaultIndex <= 0) {
    return merged;
  }
  const defaultItem = merged[defaultIndex];
  return [defaultItem, ...merged.slice(0, defaultIndex), ...merged.slice(defaultIndex + 1)];
}

/** Filter shape compatible with AdHocVariableFilter (key, operator, value). Used for building query strings. */
export interface TriageFilterInput {
  key: string;
  operator: string;
  value: string;
}

/**
 * Builds a triage saved search query string from filters, groupBy, and time range.
 * Used by triagePredefinedSearches for static single-value filter definitions.
 *
 * GroupBy keys are appended to var-filters as `key|groupBy` (2-part, no value), matching
 * the Scenes AdHocFiltersVariable URL sync format.
 */
export function buildTriageQueryStringFromParts(input: {
  filters?: TriageFilterInput[];
  groupBy: string[];
  timeRange: RawTimeRange;
}): string {
  const params = new URLSearchParams();
  params.set(SAVED_SEARCH_VERSION_PARAM, SCENES_SAVED_SEARCH_VERSION);

  for (const filter of input.filters ?? []) {
    params.append(URL_PARAMS.filters, [filter.key, filter.operator, filter.value].map(escapeFilterPart).join('|'));
  }

  input.groupBy.filter(Boolean).forEach((key) => {
    params.append(URL_PARAMS.filters, `${escapeFilterPart(key)}|${GROUP_BY_OPERATOR}`);
  });

  const fromValue =
    typeof input.timeRange.from === 'string' ? input.timeRange.from : input.timeRange.from.toISOString();
  const toValue = typeof input.timeRange.to === 'string' ? input.timeRange.to : input.timeRange.to.toISOString();
  params.set(URL_PARAMS.timeFrom, fromValue);
  params.set(URL_PARAMS.timeTo, toValue);

  return params.toString();
}

/**
 * Serializes the current triage page state from the URL to a query string.
 *
 * This function reads the current URL parameters that define the triage view state
 * and returns them as a serialized query string suitable for storage.
 *
 * @returns Serialized query string containing filters (including groupBy entries) and time range
 *
 * @example
 * // URL: /alerting/alerts?var-filters=alertname|=|test&var-filters=grafana_folder|groupBy&from=now-1h&to=now
 * serializeCurrentSearchState()
 * // Returns: "var-filters=alertname%7C%3D%7Ctest&var-filters=grafana_folder%7CgroupBy&from=now-1h&to=now"
 */
export function serializeCurrentSearchState(): string {
  const currentParams = locationService.getSearch();
  const params = new URLSearchParams();

  // Copy relevant params - use getAll() for multi-value support (var-filters)
  TRIAGE_STATE_URL_PARAMS.forEach((key) => {
    const values = currentParams.getAll(key);
    values.forEach((value) => params.append(key, value));
  });

  return params.toString();
}

/**
 * Serializes triage state (filters, groupBy, time range) into a query string.
 * This is used by the component to serialize the current Scene state for saved searches.
 *
 * @param filtersVar - Scene variable containing filters and groupBy entries
 * @param timeRange - Raw time range with from/to as strings, Date, or DateTime objects
 * @returns Serialized query string
 */
export function serializeTriageState(filtersVar: AdHocFiltersVariable, timeRange: RawTimeRange): string {
  const params = new URLSearchParams();
  params.set(SAVED_SEARCH_VERSION_PARAM, SCENES_SAVED_SEARCH_VERSION);
  const filterValues = filtersVar.urlSync?.getUrlState()[URL_PARAMS.filters] ?? [];

  for (const filter of typeof filterValues === 'string' ? [filterValues] : filterValues) {
    params.append(URL_PARAMS.filters, filter);
  }

  const fromValue = typeof timeRange.from === 'string' ? timeRange.from : timeRange.from.toISOString();
  const toValue = typeof timeRange.to === 'string' ? timeRange.to : timeRange.to.toISOString();
  params.set(URL_PARAMS.timeFrom, fromValue);
  params.set(URL_PARAMS.timeTo, toValue);

  return params.toString();
}

/**
 * Applies a saved search query to Scene variables.
 * Updates filters (including groupBy entries) and time range by directly calling variable methods.
 *
 * This uses direct state updates instead of URL navigation because Scenes' URL sync
 * has a limitation: updateFromUrl() only receives CHANGED values. When a parameter
 * is absent from the saved search (e.g., to clear groupBy), it won't trigger an update.
 *
 * Backward compatibility: also reads legacy `var-groupBy` params and converts them to
 * groupBy filter entries, so searches saved before the unified variable migration still work.
 *
 * @param scene - The scene object containing the variables
 * @param query - The saved search query string
 */
export function applyTriageSavedSearchState(scene: SceneObject, query: string): void {
  const params = parseTriageSavedSearch(query);

  // Update filters (includes groupBy entries encoded as key|groupBy)
  const filtersVar = sceneGraph.lookupVariable(VARIABLES.filters, scene);
  if (filtersVar instanceof AdHocFiltersVariable) {
    // Pass an empty array explicitly so searches without filters clear the previous state.
    filtersVar.urlSync?.updateFromUrl({
      [URL_PARAMS.filters]: params.getAll(URL_PARAMS.filters),
    });
  }

  // Update time range
  const sceneTimeRange = sceneGraph.getTimeRange(scene);
  const from = params.get(URL_PARAMS.timeFrom) ?? 'now-4h';
  const to = params.get(URL_PARAMS.timeTo) ?? 'now';
  const fromDateTime = dateMath.parse(from, false);
  const toDateTime = dateMath.parse(to, true);

  if (fromDateTime && toDateTime) {
    sceneTimeRange.onTimeRangeChange(makeTimeRange(fromDateTime, toDateTime));
  }
}

function escapeFilterPart(value: string): string {
  return escapeURLDelimiters(value).replaceAll('#', '__gfh__');
}

function parseTriageSavedSearch(query: string): URLSearchParams {
  const savedParams = new URLSearchParams(query);
  const isLegacy = savedParams.get(SAVED_SEARCH_VERSION_PARAM) !== SCENES_SAVED_SEARCH_VERSION;
  const params = new URLSearchParams();

  for (const [key, value] of savedParams) {
    if (key === SAVED_SEARCH_VERSION_PARAM) {
      continue;
    }

    if (key === 'var-groupBy') {
      if (value) {
        params.append(URL_PARAMS.filters, `${escapeFilterPart(value)}|${GROUP_BY_OPERATOR}`);
      }
    } else if (key === URL_PARAMS.filters && isLegacy) {
      // Legacy searches escaped only pipes; commas and hashes were literal filter data.
      params.append(key, value.replaceAll(',', '__gfc__').replaceAll('#', '__gfh__'));
    } else {
      params.append(key, value);
    }
  }

  return params;
}

/**
 * Generates a URL for applying a saved search.
 *
 * @param query - The saved search query string
 * @param basePath - The base path for the URL (defaults to /alerting/alerts)
 * @returns Full URL path with query parameters
 */
export function generateTriageUrl(query: string, basePath = '/alerting/alerts'): string {
  const params = parseTriageSavedSearch(query).toString();
  return params ? `${basePath}?${params}` : basePath;
}

/**
 * Applies a saved search by navigating to the URL with saved parameters.
 *
 * This function:
 * 1. Parses the saved query string
 * 2. Builds a new URL with only the saved triage parameters
 * 3. Uses locationService to navigate, triggering proper React Router and Scene sync
 *
 * Using locationService ensures the Scene framework's URL sync properly updates
 * the Scene variables (filters, groupBy, time range) based on the new URL.
 *
 * @param query - The saved search query string to apply
 *
 * @example
 * // Apply a saved search
 * applySavedSearch("var-filters=alertname%7C%3D%7Ctest&var-filters=grafana_folder%7CgroupBy&from=now-1h&to=now");
 * // URL is updated and Scene variables are synced
 */
export function applySavedSearch(query: string): void {
  // Use generateTriageUrl to build the full path with query params
  const url = generateTriageUrl(query);

  // Use locationService for proper React Router integration
  // This triggers the Scene's URL sync mechanism
  locationService.push(url);
}

/**
 * Utility functions for serializing and applying saved searches on the Triage page.
 *
 * These functions handle the conversion between URL parameters and saved search
 * query strings, preserving filters, groupBy selections, and time range.
 */

import { AdHocVariableFilter, RawTimeRange, dateMath, makeTimeRange } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable, SceneObject, sceneGraph } from '@grafana/scenes';

import { toFilters, toUrl } from '../../../../variables/adhoc/urlParser';
import { VARIABLES } from '../constants';

/**
 * URL parameter keys relevant to triage saved searches.
 * - var-filters: Ad-hoc filters (can have multiple values)
 * - var-groupBy: Group by label selections
 * - from/to: Time range
 */
const TRIAGE_URL_PARAMS = ['var-filters', 'var-groupBy', 'from', 'to'] as const;

/**
 * Serializes the current triage page state from the URL to a query string.
 *
 * This function reads the current URL parameters that define the triage view state
 * and returns them as a serialized query string suitable for storage.
 *
 * @returns Serialized query string containing filters, groupBy, and time range
 *
 * @example
 * // URL: /alerting/alerts?var-filters=alertname|=|test&var-groupBy=severity&from=now-1h&to=now
 * serializeCurrentState()
 * // Returns: "var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now"
 */
export function serializeCurrentState(): string {
  const currentUrl = new URL(window.location.href);
  const params = new URLSearchParams();

  // Copy relevant params - use getAll() for multi-value support (var-filters)
  TRIAGE_URL_PARAMS.forEach((key) => {
    const values = currentUrl.searchParams.getAll(key);
    values.forEach((value) => params.append(key, value));
  });

  return params.toString();
}

/**
 * Serializes triage state (filters, groupBy, time range) into a query string.
 * This is used by the component to serialize the current Scene state for saved searches.
 *
 * @param filters - Array of AdHocVariableFilter objects
 * @param groupBy - Array of groupBy keys (or single string)
 * @param timeRange - Raw time range with from/to as strings, Date, or DateTime objects
 * @returns Serialized query string
 */
export function serializeTriageState(
  filters: AdHocVariableFilter[],
  groupBy: string | string[],
  timeRange: RawTimeRange
): string {
  const params = new URLSearchParams();

  // Add filters using toUrl (properly escapes pipes in values with __gfp__)
  toUrl(filters).forEach((filterStr) => {
    params.append('var-filters', filterStr);
  });

  // Add groupBy
  const groupByArray = Array.isArray(groupBy) ? groupBy : [groupBy].filter(Boolean);
  groupByArray.forEach((key) => {
    if (key) {
      params.append('var-groupBy', key);
    }
  });

  // Add time range
  const fromValue = typeof timeRange.from === 'string' ? timeRange.from : timeRange.from.toISOString();
  const toValue = typeof timeRange.to === 'string' ? timeRange.to : timeRange.to.toISOString();

  params.set('from', fromValue);
  params.set('to', toValue);

  return params.toString();
}

/**
 * Applies a saved search query to Scene variables.
 * Updates filters, groupBy, and time range by directly calling variable methods.
 *
 * This uses direct state updates instead of URL navigation because Scenes' URL sync
 * has a limitation: updateFromUrl() only receives CHANGED values. When a parameter
 * is absent from the saved search (e.g., to clear groupBy), it won't trigger an update.
 *
 * @param scene - The scene object containing the variables
 * @param query - The saved search query string
 */
export function applyTriageSavedSearchState(scene: SceneObject, query: string): void {
  const params = new URLSearchParams(query);

  // Update filters
  const filtersVar = sceneGraph.lookupVariable(VARIABLES.filters, scene);
  if (filtersVar instanceof AdHocFiltersVariable) {
    filtersVar.updateFilters(extractFilterObjects(query));
  }

  // Update groupBy (explicitly set to empty array if absent)
  const groupByVar = sceneGraph.lookupVariable(VARIABLES.groupBy, scene);
  if (groupByVar instanceof GroupByVariable) {
    groupByVar.changeValueTo(params.getAll('var-groupBy').filter(Boolean));
  }

  // Update time range
  const sceneTimeRange = sceneGraph.getTimeRange(scene);
  const from = params.get('from') ?? 'now-4h';
  const to = params.get('to') ?? 'now';
  const fromDateTime = dateMath.parse(from, false);
  const toDateTime = dateMath.parse(to, true);

  if (fromDateTime && toDateTime) {
    sceneTimeRange.onTimeRangeChange(makeTimeRange(fromDateTime, toDateTime));
  }
}

/**
 * Extracts and parses filter values from a saved search query into filter objects.
 * Uses the standard toFilters utility which properly handles __gfp__ escaped pipes.
 * Converts to AdHocVariableFilter format with values array for Scenes compatibility.
 *
 * @param query - The saved search query string
 * @returns Array of filter objects compatible with AdHocFiltersVariable
 */
export function extractFilterObjects(query: string): AdHocVariableFilter[] {
  const params = new URLSearchParams(query);
  const filterValues = params.getAll('var-filters');
  const filters = toFilters(filterValues);

  // Add values array for Scenes URL sync compatibility
  // Scenes expects both value (for single operators) and values (for multi-value operators)
  return filters.map((filter) => ({
    ...filter,
    values: [filter.value],
  }));
}

/**
 * Generates a URL for applying a saved search.
 *
 * @param query - The saved search query string
 * @param basePath - The base path for the URL (defaults to /alerting/alerts)
 * @returns Full URL path with query parameters
 */
export function generateTriageUrl(query: string, basePath = '/alerting/alerts'): string {
  if (!query) {
    return basePath;
  }
  return `${basePath}?${query}`;
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
 * applySavedSearch("var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now");
 * // URL is updated and Scene variables are synced
 */
export function applySavedSearch(query: string): void {
  // Use generateTriageUrl to build the full path with query params
  const url = generateTriageUrl(query);

  // Use locationService for proper React Router integration
  // This triggers the Scene's URL sync mechanism
  locationService.push(url);
}

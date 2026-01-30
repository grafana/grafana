/**
 * Utility functions for serializing and applying saved searches on the Triage page.
 *
 * These functions handle the conversion between URL parameters and saved search
 * query strings, preserving filters, groupBy selections, and time range.
 */

import { RawTimeRange } from '@grafana/data';
import { locationService } from '@grafana/runtime';

/**
 * URL parameter keys relevant to triage saved searches.
 * - var-filters: Ad-hoc filters (can have multiple values)
 * - var-groupBy: Group by label selections
 * - from/to: Time range
 */
const TRIAGE_URL_PARAMS = ['var-filters', 'var-groupBy', 'from', 'to'] as const;

/**
 * State structure for serializing Scene state.
 */
export interface TriageSceneState {
  /** Raw time range with from/to as strings (e.g., "now-1h", "now") or Date objects */
  timeRange: RawTimeRange;
  /** Array of filter strings in "key|operator|value" format */
  filters: string[];
  /** Array of groupBy keys */
  groupBy: string[];
}

/**
 * Serializes Scene state (time range, filters, groupBy) to a query string.
 *
 * This function takes the current Scene state values and serializes them
 * to a URL query string format suitable for storage as a saved search.
 *
 * Use this function inside Scene components where you need reactive updates
 * when Scene state changes. For detecting initial URL parameters on page load
 * (before the Scene renders), use `serializeCurrentState()` instead.
 *
 * @param state - The Scene state containing timeRange, filters, and groupBy
 * @returns Serialized query string
 *
 * @example
 * serializeTriageSceneState({
 *   timeRange: { from: 'now-1h', to: 'now' },
 *   filters: ['alertname|=|test'],
 *   groupBy: ['severity']
 * })
 * // Returns: "var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now"
 */
export function serializeTriageSceneState(state: TriageSceneState): string {
  const params = new URLSearchParams();

  // Add filters (can have multiple values)
  state.filters.forEach((filter) => {
    if (filter) {
      params.append('var-filters', filter);
    }
  });

  // Add groupBy (can have multiple values)
  state.groupBy.forEach((key) => {
    if (key) {
      params.append('var-groupBy', key);
    }
  });

  // Add time range - convert to string if needed
  const fromValue =
    typeof state.timeRange.from === 'string' ? state.timeRange.from : state.timeRange.from.toISOString();
  const toValue = typeof state.timeRange.to === 'string' ? state.timeRange.to : state.timeRange.to.toISOString();

  params.set('from', fromValue);
  params.set('to', toValue);

  return params.toString();
}

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
 * Parses a var-filters URL value into a filter object.
 *
 * The var-filters format in Grafana Scenes is: "key|operator|value"
 * where the pipe character separates the three parts.
 *
 * @param filterStr - The URL-decoded filter string (e.g., "alertname|=|test")
 * @returns Parsed filter object or null if the format is invalid
 *
 * @example
 * parseFilterString("alertname|=|test")
 * // Returns: { key: "alertname", operator: "=", value: "test" }
 *
 * parseFilterString("severity|=~|critical|warning")
 * // Returns: { key: "severity", operator: "=~", value: "critical|warning" }
 * // Note: value can contain pipes for regex patterns
 */
export function parseFilterString(filterStr: string): { key: string; operator: string; value: string } | null {
  // Split only on the first two pipes to handle values containing pipes
  const firstPipe = filterStr.indexOf('|');
  if (firstPipe === -1) {
    return null;
  }

  const key = filterStr.substring(0, firstPipe);
  const rest = filterStr.substring(firstPipe + 1);

  const secondPipe = rest.indexOf('|');
  if (secondPipe === -1) {
    return null;
  }

  const operator = rest.substring(0, secondPipe);
  const value = rest.substring(secondPipe + 1);

  if (!key || !operator) {
    return null;
  }

  return { key, operator, value };
}

/**
 * Validates that a saved search query string has valid structure.
 *
 * This is a lightweight check to ensure the query string can be parsed
 * and applied without errors.
 *
 * @param query - The saved search query string
 * @returns True if the query is valid, false otherwise
 */
export function isValidTriageQuery(query: string): boolean {
  if (!query) {
    // Empty query is valid (represents default state)
    return true;
  }

  try {
    // eslint-disable-next-line no-new
    new URLSearchParams(query);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts time range from a saved search query.
 *
 * @param query - The saved search query string
 * @returns Object with from and to values, or defaults if not present
 */
export function extractTimeRange(query: string): { from: string; to: string } {
  const params = new URLSearchParams(query);
  return {
    from: params.get('from') ?? 'now-4h',
    to: params.get('to') ?? 'now',
  };
}

/**
 * Extracts groupBy value from a saved search query.
 *
 * @param query - The saved search query string
 * @returns The groupBy value or null if not present
 */
export function extractGroupBy(query: string): string | null {
  const params = new URLSearchParams(query);
  return params.get('var-groupBy');
}

/**
 * Extracts all filter values from a saved search query.
 *
 * @param query - The saved search query string
 * @returns Array of filter strings in "key|operator|value" format
 */
export function extractFilters(query: string): string[] {
  const params = new URLSearchParams(query);
  return params.getAll('var-filters');
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

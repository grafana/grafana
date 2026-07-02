/**
 * Serialization helpers for Alert quality saved searches and URL state.
 *
 * The Alert quality tab drives three URL parameters:
 * - `search`          — the rules query (folder / labels / name), owned by useRulesFilter
 * - `qualitySeverity` — single severity tier (high | medium | low)
 * - `qualityFinding`  — finding type(s), repeated for the multiselect
 *
 * A saved search stores these same parameters as its `query` string (the same approach the
 * Triage page uses), so saving from the top bar also captures the sidebar selections.
 *
 * Backward compatibility: earlier saved searches stored a raw rules query (e.g. "rule:cpu").
 * Such legacy queries contain none of the parameter keys below and are treated as `search`.
 */

import { FINDING_TYPES, type FindingType, QUALITY_SEVERITIES, type SeverityFilterValue } from './qualityFindingFilters';

/** URL / saved-search parameter keys owned by the Alert quality tab. */
export const QUALITY_PARAMS = {
  search: 'search',
  severity: 'qualitySeverity',
  finding: 'qualityFinding',
} as const;

const QUALITY_BASE_PATH = '/alerting/list/quality';

/** The decoded state behind the Alert quality URL / a saved search query. */
export interface QualitySearchState {
  search: string;
  severity: SeverityFilterValue;
  findingTypes: FindingType[];
}

function parseSeverity(value: string | null): SeverityFilterValue {
  return QUALITY_SEVERITIES.find((severity) => severity === value) ?? 'all';
}

function parseFindingTypes(values: string[]): FindingType[] {
  // Preserve display order and drop anything unrecognized so a stale URL can't inject junk.
  return FINDING_TYPES.filter((type) => values.includes(type));
}

/**
 * Whether a stored query predates the composite format (a raw rules query with none of the
 * Alert quality parameter keys). Such queries are interpreted as a bare `search` value.
 */
function isLegacyQuery(params: URLSearchParams): boolean {
  return (
    !params.has(QUALITY_PARAMS.search) && !params.has(QUALITY_PARAMS.severity) && !params.has(QUALITY_PARAMS.finding)
  );
}

/**
 * Decode an Alert quality saved-search query string (or URL query string) into its parts.
 */
export function parseQualitySearch(query: string): QualitySearchState {
  const params = new URLSearchParams(query);

  if (query.length > 0 && isLegacyQuery(params)) {
    return { search: query, severity: 'all', findingTypes: [] };
  }

  return {
    search: params.get(QUALITY_PARAMS.search) ?? '',
    severity: parseSeverity(params.get(QUALITY_PARAMS.severity)),
    findingTypes: parseFindingTypes(params.getAll(QUALITY_PARAMS.finding)),
  };
}

/**
 * Build a partial URL-params object for an Alert quality state, suitable for
 * useURLSearchParams' update function. Inactive dimensions are set to `undefined` so applying
 * a search clears any previously-active filter in that dimension.
 */
export function qualitySearchToParams(state: QualitySearchState): Record<string, string | string[] | undefined> {
  return {
    [QUALITY_PARAMS.search]: state.search || undefined,
    [QUALITY_PARAMS.severity]: state.severity !== 'all' ? state.severity : undefined,
    [QUALITY_PARAMS.finding]: state.findingTypes.length > 0 ? state.findingTypes : undefined,
  };
}

/**
 * Serialize an Alert quality state into a saved-search / URL query string. Only active
 * dimensions are included, so an unfiltered state serializes to an empty string.
 */
export function serializeQualitySearch(state: QualitySearchState): string {
  const params = new URLSearchParams();

  if (state.search) {
    params.set(QUALITY_PARAMS.search, state.search);
  }
  if (state.severity !== 'all') {
    params.set(QUALITY_PARAMS.severity, state.severity);
  }
  state.findingTypes.forEach((type) => params.append(QUALITY_PARAMS.finding, type));

  return params.toString();
}

/**
 * Build the URL params used to apply a stored saved-search query (handles legacy queries).
 */
export function savedQueryToParams(query: string): Record<string, string | string[] | undefined> {
  return qualitySearchToParams(parseQualitySearch(query));
}

/**
 * Saved searches applied from the Alert quality tab should link back to it, not the rule list.
 * Normalizes both composite and legacy queries into the current URL format.
 */
export function getQualitySearchHref(search: { query: string }): string {
  const queryString = serializeQualitySearch(parseQualitySearch(search.query));
  return queryString ? `${QUALITY_BASE_PATH}?${queryString}` : QUALITY_BASE_PATH;
}

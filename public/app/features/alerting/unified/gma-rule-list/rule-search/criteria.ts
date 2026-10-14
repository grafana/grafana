/**
 * Shared types for the GMA rule-list search language: a flat sequence of free text and
 * `key:value` filter tokens (see README.md for the exact syntax). Kept separate from the
 * rule search request shape (searchQueryLeaves.ts) so the query language never has to grow
 * new syntax purely to express the API's request structure.
 */

/** Reserved `policy` value that stands for "rules using the default notification policy". */
export const DEFAULT_POLICY = 'default';

export type LabelOperator = 'equal' | 'notEqual' | 'regex' | 'notRegex' | 'exists' | 'absent';

export interface LabelMatcher {
  key: string;
  operator: LabelOperator;
  /** Absent for `exists`/`absent`, which carry no value. */
  value?: string;
}

/**
 * Canonical, page-agnostic representation of applied search criteria. A page only ever
 * populates the fields its token registry defines (see tokens.ts); the search
 * request builders (alertRuleSearchQuery.ts, recordingRuleSearchQuery.ts) read only the fields relevant to their rule kind.
 */
export interface Criteria {
  /** Free-form words/quoted phrases and `rule:` values, in the order they were parsed.
   * Both map to the same request text leaf: they mean the same thing (a title search) so
   * there's no reason to keep them separate downstream. */
  text: string[];
  /** Folder UIDs. Never holds a display name — a name that failed migration resolution is
   * kept in `unresolved`, not here (see below). */
  namespaces: string[];
  /** Query datasource UIDs. Same rule as `namespaces` for unresolved entries. */
  dataSourceUids: string[];
  labels: LabelMatcher[];
  hidePluginRules: boolean;

  /** Folder/datasource display names that URL migration could not resolve to a UID —
   * kept as-is (never dropped) rather than mixed into `namespaces`/`dataSourceUids`, so a
   * resolved UID and an unresolved name are never ambiguous. Only ever populated by
   * migrationResolve.ts; getCriteriaIssues() surfaces these so the page can show the token
   * as invalid and skip the request, rather than silently searching without that filter.
   * serialize() keeps them in the URL unchanged. */
  unresolved: Array<{ key: 'namespace' | 'datasource'; value: string }>;

  // Alert-only
  dashboardUid?: string;
  /** Only meaningful paired with dashboardUid (panel IDs are dashboard-local) — see
   * getCriteriaIssues() for the 'requiresDashboard' issue this produces on its own. */
  panelId?: string;
  contactPoint?: string;
  /** Named routing tree, or `DEFAULT_POLICY` for the default-policy filter (not searchable yet). */
  policy?: string;
  paused?: 'true' | 'false';

  // Recording-only
  metric?: string;
  targetDataSourceUid?: string;

  /** Pending (state/health): filtering isn't deployed yet, so these are preserved for
   * round-tripping and future UI but never turned into a search predicate. */
  state?: string;
  health?: string;
}

export function createEmptyCriteria(): Criteria {
  return {
    text: [],
    namespaces: [],
    dataSourceUids: [],
    labels: [],
    hidePluginRules: false,
    unresolved: [],
  };
}

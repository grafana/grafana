/**
 * Shared types for the GMA rule-list search language: a flat sequence of free text and
 * `key:value` filter tokens (see README.md for the exact syntax). Kept separate from the
 * rule search request shape (searchQueryLeaves.ts) so the query language never has to grow
 * new syntax purely to express the API's request structure.
 */

/** Reserved `policy` value that stands for "rules using the default notification policy". */
export const DEFAULT_POLICY = 'default';

/** Spellings the `state:` and `health:` tokens accept, kept as the old list's so existing links keep working. */
export const STATE_VALUES = ['firing', 'pending', 'recovering', 'normal', 'inactive'] as const;
export const HEALTH_VALUES = ['ok', 'nodata', 'error', 'err', 'unknown'] as const;

export type StateValue = (typeof STATE_VALUES)[number];
export type HealthValue = (typeof HEALTH_VALUES)[number];

export type LabelOperator = 'equal' | 'notEqual' | 'regex' | 'notRegex' | 'exists' | 'absent';

export interface LabelMatcher {
  key: string;
  operator: LabelOperator;
  /** Absent for `exists`/`absent`, which carry no value. */
  value?: string;
}

export interface InvalidToken {
  key: string;
  /** The token exactly as it was written, so serializing keeps it unchanged. */
  raw: string;
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
  /** Folder UIDs. Display names are resolved to UIDs only by legacy-link migration. */
  namespaces: string[];
  /** Query datasource UIDs. */
  dataSourceUids: string[];
  labels: LabelMatcher[];
  hidePluginRules: boolean;

  /** Tokens the page cannot apply: an unsupported key, an incomplete or malformed value, or a
   * repeat of a single-value token. They stay in the criteria (and the URL) as typed so they are
   * shown as invalid and never silently dropped; getCriteriaIssues() reports them and the page
   * sends no request while any are present. */
  invalid: InvalidToken[];

  // Alert-only
  dashboardUid?: string;
  /** Only meaningful paired with dashboardUid (panel IDs are dashboard-local) — see
   * getCriteriaIssues() for the 'requiresDashboard' issue this produces on its own. */
  panelId?: string;
  contactPoint?: string;
  /** Named routing tree, or `DEFAULT_POLICY` for the default-policy filter (not searchable yet). */
  policy?: string;
  paused?: 'true' | 'false';
  state?: StateValue;

  // Recording-only
  metric?: string;
  targetDataSourceUid?: string;
  health?: HealthValue;
}

export function createEmptyCriteria(): Criteria {
  return {
    text: [],
    namespaces: [],
    dataSourceUids: [],
    labels: [],
    hidePluginRules: false,
    invalid: [],
  };
}

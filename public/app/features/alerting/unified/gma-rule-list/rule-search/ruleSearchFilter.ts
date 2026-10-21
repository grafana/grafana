/** Reserved `policy` value that stands for "rules using the default notification policy". */
export const DEFAULT_POLICY = 'default';

/** Kept as the old list's spellings so existing links keep working. */
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

export interface RuleSearchFilter {
  text: string[];
  /** Folder UIDs. Display names are resolved to UIDs only by legacy-link migration. */
  namespaces: string[];
  /** Query datasource UIDs. */
  dataSourceUids: string[];
  labels: LabelMatcher[];
  hidePluginRules: boolean;

  /** Tokens the page cannot apply, kept as typed so they show as invalid; no request is sent while any exist. */
  invalid: InvalidToken[];

  // Alert-only
  dashboardUid?: string;
  /** Panel IDs are dashboard-local, so only meaningful with dashboardUid. */
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

export function createEmptyFilter(): RuleSearchFilter {
  return {
    text: [],
    namespaces: [],
    dataSourceUids: [],
    labels: [],
    hidePluginRules: false,
    invalid: [],
  };
}

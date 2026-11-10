import {
  type AlertRuleAlertRuleHealth,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/** What both pages' search filters hold; each page's filter type adds its own filters to it. */
export interface SharedRuleFilter {
  text: string[];
  /** At most one folder name, as typed, since a later `folder:` replaces it. It matches folders by title text. */
  folders: string[];
  /** Query datasource UIDs. */
  dataSourceUids: string[];
  labels: SearchLabelMatcher[];
  hidePluginRules: boolean;
  health?: HealthValue;
}

/** The rule search filters folders by UID only, so `filter.folders` names are resolved to `folderUids` first. */
export interface RuleSearchApiArgs<Filter extends SharedRuleFilter> {
  filter: Filter;
  folderUids: string[];
}

/** A filter for either page, empty but for `overrides`, since each page's own filters are optional. */
export function createRulesApiFilter(overrides: Partial<SharedRuleFilter> = {}): SharedRuleFilter {
  return {
    text: [],
    folders: [],
    dataSourceUids: [],
    labels: [],
    hidePluginRules: false,
    ...overrides,
  };
}

export interface SearchLabelMatcher {
  key: string;
  operator: LabelOperator;
  /** Absent for `exists`/`absent`, which carry no value. */
  value?: string;
}

type LabelOperator = 'equal' | 'notEqual' | 'regex' | 'notRegex' | 'exists' | 'absent';

/** Each `health:` value and the API health it matches on both kinds; `ok` is per kind, see `HealthValue`. */
export const HEALTH_API_VALUES = {
  nodata: 'NoData',
  error: 'Error',
  unknown: 'Unknown',
} satisfies Record<string, AlertRuleAlertRuleHealth & RecordingRuleRecordingRuleHealth>;

/** `ok` is `OK` on Alert rules and `Recording` on Recording rules. */
export type HealthValue = 'ok' | keyof typeof HEALTH_API_VALUES;

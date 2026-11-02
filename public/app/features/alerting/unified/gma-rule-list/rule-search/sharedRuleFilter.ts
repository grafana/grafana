import {
  type AlertRuleAlertRuleHealth,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/** What both pages' search filters hold; each page's filter type adds its own filters to it. */
export interface SharedRuleFilter {
  text: string[];
  /** Folder UIDs. */
  folders: string[];
  /** Query datasource UIDs. */
  dataSourceUids: string[];
  labels: SearchLabelMatcher[];
  hidePluginRules: boolean;
  health?: HealthValue;
}

/** An empty filter for either page, since each page's own filters are optional. */
export function createEmptyFilter(): SharedRuleFilter {
  return {
    text: [],
    folders: [],
    dataSourceUids: [],
    labels: [],
    hidePluginRules: false,
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

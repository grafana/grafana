import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/** Reserved `policy` value that stands for "rules using the default notification policy". */
export const DEFAULT_POLICY = 'default';

/** Each `state:` value and the API states it matches. */
export const STATE_API_VALUES = {
  firing: ['Firing'],
  pending: ['Pending'],
  recovering: ['Recovering'],
  // Neither has a firing, pending or recovering instance.
  normal: ['Healthy', 'Inactive'],
} satisfies Record<string, AlertRuleAlertRuleState[]>;

/** Each `health:` value and the API health it matches on both kinds; `ok` is per kind, see `HealthValue`. */
export const HEALTH_API_VALUES = {
  nodata: 'NoData',
  error: 'Error',
  unknown: 'Unknown',
} satisfies Record<string, AlertRuleAlertRuleHealth & RecordingRuleRecordingRuleHealth>;

export type StateValue = keyof typeof STATE_API_VALUES;
/** `ok` is `OK` on Alert rules and `Recording` on Recording rules. */
export type HealthValue = 'ok' | keyof typeof HEALTH_API_VALUES;

export interface SearchLabelMatcher {
  key: string;
  operator: LabelOperator;
  /** Absent for `exists`/`absent`, which carry no value. */
  value?: string;
}

export interface RuleSearchFilter {
  text: string[];
  /** Folder UIDs. */
  folders: string[];
  /** Query datasource UIDs. */
  dataSourceUids: string[];
  labels: SearchLabelMatcher[];
  hidePluginRules: boolean;
  health?: HealthValue;

  // Alert-only
  dashboardUid?: string;
  panelId?: string;
  contactPoint?: string;
  /** Named routing tree, or `DEFAULT_POLICY` for the default-policy filter (not searchable yet). */
  policy?: string;
  paused?: 'true' | 'false';
  state?: StateValue;

  // Recording-only
  metric?: string;
  targetDataSourceUid?: string;
}

export function createEmptyFilter(): RuleSearchFilter {
  return {
    text: [],
    folders: [],
    dataSourceUids: [],
    labels: [],
    hidePluginRules: false,
  };
}

type LabelOperator = 'equal' | 'notEqual' | 'regex' | 'notRegex' | 'exists' | 'absent';

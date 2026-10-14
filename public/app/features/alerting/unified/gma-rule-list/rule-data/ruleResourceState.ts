import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/** The full resource fetch state a row/menu is built from - never a legacy rule/group shape. */
export type RuleResourceState<T extends AlertRule | RecordingRule> =
  | { status: 'loading'; rule?: undefined }
  | { status: 'error'; rule?: undefined }
  | { status: 'loaded'; rule: T };

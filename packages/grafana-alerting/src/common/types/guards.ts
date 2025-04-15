import type { Rule, AlertingRule, RecordingRule } from './api';

/* Check if the given rule is a AlertingRule API response object */
export function isAlertingRule(rule: Rule): rule is AlertingRule {
  return rule.type === 'alerting';
}

/* Check if the given rule is a RecordingRule API response object */
export function isRecordingRule(rule: Rule): rule is RecordingRule {
  return rule.type === 'recording';
}

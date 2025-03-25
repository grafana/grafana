import type { Rule, AlertingRule, RecordingRule } from './common/api';
import {
  PrometheusAlertingRuleDefinition,
  PrometheusRecordingRuleDefinition,
  PrometheusRuleDefinition,
} from './prometheus/rules/definitions';

export const prometheusRuleType = {
  rule: (rule: Rule) => isAlertingRule(rule) || isRecordingRule(rule),
  alertingRule: isAlertingRule,
  recordingRule: isRecordingRule,
};

/* Check if the given rule is a AlertingRule API response object */
function isAlertingRule(rule: Rule): rule is AlertingRule {
  return rule.type === 'alerting';
}

/* Check if the given rule is a RecordingRule API response object */
function isRecordingRule(rule: Rule): rule is RecordingRule {
  return rule.type === 'recording';
}

/*
 * Check if the given rule defintion is a AlertingRule definition
 * Used for YAML / JSON definitions (these don't include a "type")
 */
export function isAlertingRuleDefinition(rule: PrometheusRuleDefinition): rule is PrometheusAlertingRuleDefinition {
  return 'alert' in rule;
}

/*
 * Check if the given rule defintion is a RecordingRule definition
 * Used for YAML / JSON definitions (these don't include a "type")
 */
export function isRecordingRuleDefinition(rule: PrometheusRuleDefinition): rule is PrometheusRecordingRuleDefinition {
  return 'record' in rule;
}

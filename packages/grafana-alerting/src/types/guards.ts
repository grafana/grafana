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

// for API response objects
function isAlertingRule(rule: Rule): rule is AlertingRule {
  return 'type' in rule && rule.type === 'alerting';
}

// for API response objects
function isRecordingRule(rule: Rule): rule is RecordingRule {
  return 'type' in rule && rule.type === 'recording';
}

// for YAML definitions (these don't include a "type")
export function isAlertingRuleDefinition(rule: PrometheusRuleDefinition): rule is PrometheusAlertingRuleDefinition {
  return 'alert' in rule;
}

// for YAML definitions (these don't include a "type")
export function isRecordingRuleDefinition(rule: PrometheusRuleDefinition): rule is PrometheusRecordingRuleDefinition {
  return 'record' in rule;
}

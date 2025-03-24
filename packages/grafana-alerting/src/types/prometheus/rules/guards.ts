import { PrometheusAlertingRule, PrometheusRecordingRule, PrometheusRule } from './api';
import {
  PrometheusAlertingRuleDefinition,
  PrometheusRecordingRuleDefinition,
  PrometheusRuleDefinition,
} from './definitions';

export const prometheusRuleType = {
  rule: (rule: PrometheusRule) => isAlertingRule(rule) || isRecordingRule(rule),
  alertingRule: isAlertingRule,
  recordingRule: isRecordingRule,
};

// for API response objects
function isAlertingRule(rule: PrometheusRule): rule is PrometheusAlertingRule {
  return 'type' in rule && rule.type === 'alerting';
}

// for API response objects
function isRecordingRule(rule: PrometheusRule): rule is PrometheusRecordingRule {
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

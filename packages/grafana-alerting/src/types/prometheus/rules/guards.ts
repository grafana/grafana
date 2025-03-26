import {
  PrometheusAlertingRuleDefinition,
  PrometheusRecordingRuleDefinition,
  PrometheusRuleDefinition,
} from './definitions';

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

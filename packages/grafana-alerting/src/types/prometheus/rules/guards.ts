import { AlertingRuleDefinition, RecordingRuleDefinition, RuleDefinition } from './definitions';

/*
 * Check if the given rule defintion is a AlertingRule definition
 * Used for YAML / JSON definitions (these don't include a "type")
 */
export function isAlertingRuleDefinition(rule: RuleDefinition): rule is AlertingRuleDefinition {
  return 'alert' in rule;
}

/*
 * Check if the given rule defintion is a RecordingRule definition
 * Used for YAML / JSON definitions (these don't include a "type")
 */
export function isRecordingRuleDefinition(rule: RuleDefinition): rule is RecordingRuleDefinition {
  return 'record' in rule;
}

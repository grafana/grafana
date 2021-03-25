import { PromRuleType } from 'app/types/unified-alerting-dto';
import { Alert, AlertingRule, RecordingRule, Rule } from 'app/types/unified-alerting';

export function isAlertingRule(rule: Rule): rule is AlertingRule {
  return rule.type === PromRuleType.Alerting;
}

export function isRecordingRule(rule: Rule): rule is RecordingRule {
  return rule.type === PromRuleType.Recording;
}

// make an effort to generate unique key for a rule
export function ruleKey(rule: Rule): string {
  return JSON.stringify([
    rule.type,
    rule.labels,
    rule.query,
    rule.name,
    isAlertingRule(rule) ? rule.annotations : rule,
  ]);
}

export function alertInstanceKey(alert: Alert): string {
  return JSON.stringify(alert.labels);
}

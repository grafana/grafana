import { PromRuleType } from 'app/types/unified-alerting/dto';
import { AlertingRule, RecordingRule, Rule } from 'app/types/unified-alerting/internal';

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

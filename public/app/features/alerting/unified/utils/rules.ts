import { PromRuleType } from 'app/types/unified-alerting/dto';
import { AlertingRule, RecordingRule, Rule } from 'app/types/unified-alerting/internal';

export function isAlertingRule(rule: Rule): rule is AlertingRule {
  return rule.type === PromRuleType.Alerting;
}

export function isRecordingRule(rule: Rule): rule is RecordingRule {
  return rule.type === PromRuleType.Recording;
}

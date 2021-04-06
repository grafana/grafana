import {
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';
import { Alert, AlertingRule, RecordingRule, Rule } from 'app/types/unified-alerting';
import { AsyncRequestState } from './redux';
import { RULER_NOT_SUPPORTED_MSG } from './constants';
import { hash } from './misc';

export function isAlertingRule(rule: Rule): rule is AlertingRule {
  return rule.type === PromRuleType.Alerting;
}

export function isRecordingRule(rule: Rule): rule is RecordingRule {
  return rule.type === PromRuleType.Recording;
}

export function isAlertingRulerRule(rule: RulerRuleDTO): rule is RulerAlertingRuleDTO {
  return 'alert' in rule;
}

export function isRecordingRulerRule(rule: RulerRuleDTO): rule is RulerRecordingRuleDTO {
  return 'record' in rule;
}

export function alertInstanceKey(alert: Alert): string {
  return JSON.stringify(alert.labels);
}

export function isRulerNotSupportedResponse(resp: AsyncRequestState<any>) {
  return resp.error && resp.error?.message === RULER_NOT_SUPPORTED_MSG;
}

export function hashRulerRule(rule: RulerRuleDTO): number {
  return hash(JSON.stringify(rule));
}

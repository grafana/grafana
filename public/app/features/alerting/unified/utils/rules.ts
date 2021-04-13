import {
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';
import {
  Alert,
  AlertingRule,
  CloudRuleIdentifier,
  GrafanaRuleIdentifier,
  RecordingRule,
  Rule,
  RuleIdentifier,
} from 'app/types/unified-alerting';
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

export function isGrafanaRulerRule(rule: RulerRuleDTO): rule is RulerGrafanaRuleDTO {
  return 'grafana_alert' in rule;
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

export function isGrafanaRuleIdentifier(location: RuleIdentifier): location is GrafanaRuleIdentifier {
  return 'uid' in location;
}

export function isCloudRuleIdentifier(location: RuleIdentifier): location is CloudRuleIdentifier {
  return 'ruleSourceName' in location;
}

function escapeDollars(value: string): string {
  return value.replace(/\$/g, '_DOLLAR_');
}
function unesacapeDollars(value: string): string {
  return value.replace(/\_DOLLAR\_/g, '$');
}

export function stringifyRuleIdentifier(location: RuleIdentifier): string {
  if (isGrafanaRuleIdentifier(location)) {
    return location.uid;
  }
  return [location.ruleSourceName, location.namespace, location.groupName, location.ruleHash]
    .map(String)
    .map(escapeDollars)
    .join('$');
}

export function parseRuleIdentifier(location: string): RuleIdentifier {
  const parts = location.split('$');
  if (parts.length === 1) {
    return { uid: location };
  } else if (parts.length === 4) {
    const [ruleSourceName, namespace, groupName, ruleHash] = parts.map(unesacapeDollars);
    return { ruleSourceName, namespace, groupName, ruleHash: Number(ruleHash) };
  }
  throw new Error(`Failed to parse rule location: ${location}`);
}

export function getRuleIdentifier(
  ruleSourceName: string,
  namespace: string,
  groupName: string,
  rule: RulerRuleDTO
): RuleIdentifier {
  if (isGrafanaRulerRule(rule)) {
    return { uid: rule.grafana_alert.uid! };
  }
  return {
    ruleSourceName,
    namespace,
    groupName,
    ruleHash: hashRulerRule(rule),
  };
}

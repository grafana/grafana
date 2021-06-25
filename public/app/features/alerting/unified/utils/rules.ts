import {
  Annotations,
  GrafanaAlertState,
  Labels,
  PromAlertingRuleState,
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
  PromRuleWithLocation,
  RecordingRule,
  Rule,
  RuleIdentifier,
  RuleNamespace,
  RuleWithLocation,
} from 'app/types/unified-alerting';
import { AsyncRequestState } from './redux';
import { RULER_NOT_SUPPORTED_MSG } from './constants';
import { hash } from './misc';
import { capitalize } from 'lodash';
import { State } from '../components/StateTag';

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

export function isGrafanaRulerRule(rule?: RulerRuleDTO): rule is RulerGrafanaRuleDTO {
  return typeof rule === 'object' && 'grafana_alert' in rule;
}

export function alertInstanceKey(alert: Alert): string {
  return JSON.stringify(alert.labels);
}

export function isRulerNotSupportedResponse(resp: AsyncRequestState<any>) {
  return resp.error && resp.error?.message === RULER_NOT_SUPPORTED_MSG;
}

function hashLabelsOrAnnotations(item: Labels | Annotations | undefined): string {
  return JSON.stringify(Object.entries(item || {}).sort((a, b) => a[0].localeCompare(b[0])));
}

// this is used to identify lotex rules, as they do not have a unique identifier
export function hashRulerRule(rule: RulerRuleDTO): number {
  if (isRecordingRulerRule(rule)) {
    return hash(JSON.stringify([rule.record, rule.expr, hashLabelsOrAnnotations(rule.labels)]));
  } else if (isAlertingRulerRule(rule)) {
    return hash(
      JSON.stringify([
        rule.alert,
        rule.expr,
        hashLabelsOrAnnotations(rule.annotations),
        hashLabelsOrAnnotations(rule.labels),
      ])
    );
  } else {
    throw new Error('only recording and alerting ruler rules can be hashed');
  }
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

export function ruleWithLocationToRuleIdentifier(ruleWithLocation: RuleWithLocation): RuleIdentifier {
  return getRuleIdentifier(
    ruleWithLocation.ruleSourceName,
    ruleWithLocation.namespace,
    ruleWithLocation.group.name,
    ruleWithLocation.rule
  );
}

export function alertStateToReadable(state: PromAlertingRuleState | GrafanaAlertState): string {
  if (state === PromAlertingRuleState.Inactive) {
    return 'Normal';
  }
  return capitalize(state);
}

export const flattenRules = (rules: RuleNamespace[]) => {
  return rules.reduce<PromRuleWithLocation[]>((acc, { dataSourceName, name: namespaceName, groups }) => {
    groups.forEach(({ name: groupName, rules }) => {
      rules.forEach((rule) => {
        if (isAlertingRule(rule)) {
          acc.push({ dataSourceName, namespaceName, groupName, rule });
        }
      });
    });
    return acc;
  }, []);
};

export const alertStateToState: Record<PromAlertingRuleState | GrafanaAlertState, State> = {
  [PromAlertingRuleState.Inactive]: 'good',
  [PromAlertingRuleState.Firing]: 'bad',
  [PromAlertingRuleState.Pending]: 'warning',
  [GrafanaAlertState.Alerting]: 'bad',
  [GrafanaAlertState.Error]: 'bad',
  [GrafanaAlertState.NoData]: 'info',
  [GrafanaAlertState.Normal]: 'good',
  [GrafanaAlertState.Pending]: 'warning',
};

export function getFirstActiveAt(promRule: AlertingRule) {
  if (!promRule.alerts) {
    return null;
  }
  return promRule.alerts.reduce((prev, alert) => {
    if (alert.activeAt && alert.state !== GrafanaAlertState.Normal) {
      const activeAt = new Date(alert.activeAt);
      if (prev === null || prev.getTime() > activeAt.getTime()) {
        return activeAt;
      }
    }
    return prev;
  }, null as Date | null);
}

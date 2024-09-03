import { capitalize } from 'lodash';

import { AlertState } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Alert,
  AlertingRule,
  CloudRuleIdentifier,
  CombinedRule,
  CombinedRuleGroup,
  CombinedRuleWithLocation,
  GrafanaRuleIdentifier,
  PromRuleWithLocation,
  PrometheusRuleIdentifier,
  RecordingRule,
  Rule,
  RuleGroupIdentifier,
  RuleIdentifier,
  RuleNamespace,
  RuleWithLocation,
  RulesSource,
  EditableRuleIdentifier,
} from 'app/types/unified-alerting';
import {
  GrafanaAlertState,
  GrafanaAlertStateWithReason,
  PostableRuleDTO,
  PromAlertingRuleState,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerCloudRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

import { CombinedRuleNamespace } from '../../../../types/unified-alerting';
import { State } from '../components/StateTag';
import { RuleHealth } from '../search/rulesSearchParser';
import { RuleFormType, RuleFormValues } from '../types/rule-form';

import { RULER_NOT_SUPPORTED_MSG } from './constants';
import { getRulesSourceName, isGrafanaRulesSource } from './datasource';
import { GRAFANA_ORIGIN_LABEL } from './labels';
import { AsyncRequestState } from './redux';
import { formatPrometheusDuration, safeParsePrometheusDuration } from './time';

export function isAlertingRule(rule: Rule | undefined): rule is AlertingRule {
  return typeof rule === 'object' && rule.type === PromRuleType.Alerting;
}

export function isRecordingRule(rule: Rule | undefined): rule is RecordingRule {
  return typeof rule === 'object' && rule.type === PromRuleType.Recording;
}

export function isAlertingRulerRule(rule?: RulerRuleDTO): rule is RulerAlertingRuleDTO {
  return typeof rule === 'object' && 'alert' in rule;
}

export function isRecordingRulerRule(rule?: RulerRuleDTO): rule is RulerRecordingRuleDTO {
  return typeof rule === 'object' && 'record' in rule;
}

export function isGrafanaOrDataSourceRecordingRule(rule?: RulerRuleDTO) {
  return (
    (typeof rule === 'object' && isRecordingRulerRule(rule)) ||
    (isGrafanaRulerRule(rule) && 'record' in rule.grafana_alert)
  );
}

export function isGrafanaRecordingRule(rule?: RulerRuleDTO): rule is RulerGrafanaRuleDTO {
  return typeof rule === 'object' && isGrafanaOrDataSourceRecordingRule(rule) && isGrafanaRulerRule(rule);
}

export function isGrafanaAlertingRule(rule?: RulerRuleDTO): rule is RulerGrafanaRuleDTO {
  return typeof rule === 'object' && isGrafanaRulerRule(rule) && !isGrafanaOrDataSourceRecordingRule(rule);
}

export function isGrafanaRulerRule(rule?: RulerRuleDTO | PostableRuleDTO): rule is RulerGrafanaRuleDTO {
  return typeof rule === 'object' && 'grafana_alert' in rule;
}

export function isGrafanaRecordingRulerRule(rule?: RulerRuleDTO) {
  return typeof rule === 'object' && 'grafana_alert' in rule && 'record' in rule.grafana_alert;
}

export function isCloudRulerRule(rule?: RulerRuleDTO | PostableRuleDTO): rule is RulerCloudRuleDTO {
  return typeof rule === 'object' && !isGrafanaRulerRule(rule);
}

export function isGrafanaRulerRulePaused(rule: RulerGrafanaRuleDTO) {
  return rule && isGrafanaRulerRule(rule) && Boolean(rule.grafana_alert.is_paused);
}

export function alertInstanceKey(alert: Alert): string {
  return JSON.stringify(alert.labels);
}

export function isRulerNotSupportedResponse(resp: AsyncRequestState<any>) {
  return resp.error && resp.error?.message?.includes(RULER_NOT_SUPPORTED_MSG);
}

export function isGrafanaRuleIdentifier(identifier: RuleIdentifier): identifier is GrafanaRuleIdentifier {
  return 'uid' in identifier;
}

export function isCloudRuleIdentifier(identifier: RuleIdentifier): identifier is CloudRuleIdentifier {
  return 'rulerRuleHash' in identifier;
}

export function isPromRuleType(ruleType: string): ruleType is PromRuleType {
  return Object.values<string>(PromRuleType).includes(ruleType);
}

export function isPrometheusRuleIdentifier(identifier: RuleIdentifier): identifier is PrometheusRuleIdentifier {
  return 'ruleHash' in identifier;
}

export function isEditableRuleIdentifier(identifier: RuleIdentifier): identifier is EditableRuleIdentifier {
  return isGrafanaRuleIdentifier(identifier) || isCloudRuleIdentifier(identifier);
}

export function getRuleHealth(health: string): RuleHealth | undefined {
  switch (health) {
    case 'ok':
      return RuleHealth.Ok;
    case 'nodata':
      return RuleHealth.NoData;
    case 'error':
    case 'err': // Prometheus-compat data sources
      return RuleHealth.Error;
    case 'unknown':
      return RuleHealth.Unknown;
    default:
      return undefined;
  }
}

export function getPendingPeriod(rule: CombinedRule): string | undefined {
  if (isRecordingRulerRule(rule.rulerRule) || isRecordingRule(rule.promRule)) {
    return undefined;
  }

  // We prefer the for duration from the ruler rule because it is formatted as a duration string
  // Prometheus duration is in seconds and we need to format it as a duration string
  // Additionally, due to eventual consistency of the Prometheus endpoint the ruler data might be newer
  if (isAlertingRulerRule(rule.rulerRule)) {
    return rule.rulerRule.for;
  }

  if (isAlertingRule(rule.promRule)) {
    const durationInMilliseconds = (rule.promRule.duration ?? 0) * 1000;
    return formatPrometheusDuration(durationInMilliseconds);
  }

  return undefined;
}

export interface RulePluginOrigin {
  pluginId: string;
}

export function getRulePluginOrigin(rule: CombinedRule): RulePluginOrigin | undefined {
  // com.grafana.origin=plugin/<plugin-identifier>
  // Prom and Mimir do not support dots in label names 😔
  const origin = rule.labels[GRAFANA_ORIGIN_LABEL];
  if (!origin) {
    return undefined;
  }

  const match = origin.match(/^plugin\/(?<pluginId>.+)$/);
  if (!match?.groups) {
    return undefined;
  }

  const pluginId = match.groups.pluginId;
  const pluginInstalled = isPluginInstalled(pluginId);

  if (!pluginInstalled) {
    return undefined;
  }

  return { pluginId };
}

function isPluginInstalled(pluginId: string) {
  return Boolean(config.apps[pluginId]);
}

export function isPluginProvidedRule(rule: CombinedRule): boolean {
  return Boolean(getRulePluginOrigin(rule));
}

export function alertStateToReadable(state: PromAlertingRuleState | GrafanaAlertStateWithReason | AlertState): string {
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

export const getAlertingRule = (rule: CombinedRuleWithLocation) =>
  isAlertingRule(rule.promRule) ? rule.promRule : null;

export const flattenCombinedRules = (rules: CombinedRuleNamespace[]) => {
  return rules.reduce<CombinedRuleWithLocation[]>((acc, { rulesSource, name: namespaceName, groups }) => {
    groups.forEach(({ name: groupName, rules }) => {
      rules.forEach((rule) => {
        if (rule.promRule && isAlertingRule(rule.promRule)) {
          acc.push({ dataSourceName: getRulesSourceName(rulesSource), namespaceName, groupName, ...rule });
        }
      });
    });
    return acc;
  }, []);
};

export function alertStateToState(state: PromAlertingRuleState | GrafanaAlertStateWithReason | AlertState): State {
  let key: PromAlertingRuleState | GrafanaAlertState | AlertState;
  if (Object.values(AlertState).includes(state as AlertState)) {
    key = state as AlertState;
  } else {
    key = mapStateWithReasonToBaseState(state as GrafanaAlertStateWithReason | PromAlertingRuleState);
  }

  return alertStateToStateMap[key];
}

const alertStateToStateMap: Record<PromAlertingRuleState | GrafanaAlertState | AlertState, State> = {
  [PromAlertingRuleState.Inactive]: 'good',
  [PromAlertingRuleState.Firing]: 'bad',
  [PromAlertingRuleState.Pending]: 'warning',
  [GrafanaAlertState.Alerting]: 'bad',
  [GrafanaAlertState.Error]: 'bad',
  [GrafanaAlertState.NoData]: 'info',
  [GrafanaAlertState.Normal]: 'good',
  [GrafanaAlertState.Pending]: 'warning',
  [AlertState.NoData]: 'info',
  [AlertState.Paused]: 'warning',
  [AlertState.Alerting]: 'bad',
  [AlertState.OK]: 'good',
  // AlertState.Pending is not included because the 'pending' value is already covered by `PromAlertingRuleState.Pending`
  // [AlertState.Pending]: 'warning',
  [AlertState.Unknown]: 'info',
};

export function getFirstActiveAt(promRule?: AlertingRule) {
  if (!promRule?.alerts) {
    return null;
  }
  return promRule.alerts.reduce<Date | null>((prev, alert) => {
    const isNotNormal = mapStateWithReasonToBaseState(alert.state) !== GrafanaAlertState.Normal;
    if (alert.activeAt && isNotNormal) {
      const activeAt = new Date(alert.activeAt);
      if (prev === null || prev.getTime() > activeAt.getTime()) {
        return activeAt;
      }
    }
    return prev;
  }, null);
}

/**
 * A rule group is "federated" when it has at least one "source_tenants" entry, federated rule groups will evaluate rules in multiple tenants
 * Non-federated rules do not have this property
 *
 * see https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation
 */
export function isFederatedRuleGroup(group: CombinedRuleGroup) {
  return Array.isArray(group.source_tenants);
}

export function getRuleName(rule: RulerRuleDTO) {
  if (isGrafanaRulerRule(rule)) {
    return rule.grafana_alert.title;
  }
  if (isAlertingRulerRule(rule)) {
    return rule.alert;
  }

  if (isRecordingRulerRule(rule)) {
    return rule.record;
  }

  return '';
}

export interface AlertInfo {
  alertName: string;
  forDuration?: string;
  evaluationsToFire: number | null;
}

export const getAlertInfo = (alert: RulerRuleDTO, currentEvaluation: string): AlertInfo => {
  const emptyAlert: AlertInfo = {
    alertName: '',
    forDuration: '0s',
    evaluationsToFire: 0,
  };
  if (isGrafanaRulerRule(alert)) {
    return {
      alertName: alert.grafana_alert.title,
      forDuration: alert.for,
      evaluationsToFire: alert.for ? getNumberEvaluationsToStartAlerting(alert.for, currentEvaluation) : null,
    };
  }
  if (isAlertingRulerRule(alert)) {
    return {
      alertName: alert.alert,
      forDuration: alert.for ?? '0s',
      evaluationsToFire: getNumberEvaluationsToStartAlerting(alert.for ?? '0s', currentEvaluation),
    };
  }
  return emptyAlert;
};

export const getNumberEvaluationsToStartAlerting = (forDuration: string, currentEvaluation: string) => {
  const evalNumberMs = safeParsePrometheusDuration(currentEvaluation);
  const forNumber = safeParsePrometheusDuration(forDuration);
  if (forNumber === 0 && evalNumberMs !== 0) {
    return 1;
  }
  if (evalNumberMs === 0) {
    return 0;
  } else {
    const evaluationsBeforeCeil = forNumber / evalNumberMs;
    return evaluationsBeforeCeil < 1 ? 0 : Math.ceil(forNumber / evalNumberMs) + 1;
  }
};

/*
 * Extracts a rule group identifier from a CombinedRule
 */
export function getRuleGroupLocationFromCombinedRule(rule: CombinedRule): RuleGroupIdentifier {
  const ruleSourceName = isGrafanaRulesSource(rule.namespace.rulesSource)
    ? rule.namespace.rulesSource
    : rule.namespace.rulesSource.name;

  const namespace = isGrafanaRulerRule(rule.rulerRule)
    ? rule.rulerRule.grafana_alert.namespace_uid
    : rule.namespace.name;

  return {
    dataSourceName: ruleSourceName,
    namespaceName: namespace,
    groupName: rule.group.name,
  };
}

/**
 * Extracts a rule group identifier from a RuleWithLocation
 */
export function getRuleGroupLocationFromRuleWithLocation(rule: RuleWithLocation): RuleGroupIdentifier {
  const dataSourceName = rule.ruleSourceName;

  const namespaceName = isGrafanaRulerRule(rule.rule) ? rule.rule.grafana_alert.namespace_uid : rule.namespace;
  const groupName = rule.group.name;

  return {
    dataSourceName,
    namespaceName,
    groupName,
  };
}

export function getRuleGroupLocationFromFormValues(values: RuleFormValues): RuleGroupIdentifier {
  const dataSourceName = values.dataSourceName;
  const namespaceName = values.folder?.uid ?? values.namespace;
  const groupName = values.group;

  if (!dataSourceName) {
    throw new Error('no datasource name in form values');
  }

  return {
    dataSourceName,
    namespaceName,
    groupName,
  };
}

export function rulesSourceToDataSourceName(rulesSource: RulesSource): string {
  return isGrafanaRulesSource(rulesSource) ? rulesSource : rulesSource.name;
}

export function isGrafanaAlertingRuleByType(type?: RuleFormType) {
  return type === RuleFormType.grafana;
}

export function isGrafanaRecordingRuleByType(type: RuleFormType) {
  return type === RuleFormType.grafanaRecording;
}

export function isCloudAlertingRuleByType(type?: RuleFormType) {
  return type === RuleFormType.cloudAlerting;
}

export function isCloudRecordingRuleByType(type?: RuleFormType) {
  return type === RuleFormType.cloudRecording;
}

export function isGrafanaManagedRuleByType(type: RuleFormType) {
  return isGrafanaAlertingRuleByType(type) || isGrafanaRecordingRuleByType(type);
}

export function isRecordingRuleByType(type: RuleFormType) {
  return isGrafanaRecordingRuleByType(type) || isCloudRecordingRuleByType(type);
}

export function isDataSourceManagedRuleByType(type: RuleFormType) {
  return isCloudAlertingRuleByType(type) || isCloudRecordingRuleByType(type);
}

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
  EditableRuleIdentifier,
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
} from 'app/types/unified-alerting';
import {
  Annotations,
  GrafanaAlertState,
  GrafanaAlertStateWithReason,
  GrafanaAlertingRuleDefinition,
  GrafanaPromAlertingRuleDTO,
  GrafanaPromRecordingRuleDTO,
  GrafanaRecordingRuleDefinition,
  PostableRuleDTO,
  PromAlertingRuleState,
  PromRuleDTO,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerCloudRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
  RulerRuleGroupDTO,
  mapStateWithReasonToBaseState,
} from 'app/types/unified-alerting-dto';

import { CombinedRuleNamespace } from '../../../../types/unified-alerting';
import { State } from '../components/StateTag';
import { RuleHealth, RuleSource } from '../search/rulesSearchParser';
import { RuleFormType, RuleFormValues } from '../types/rule-form';

import { RULER_NOT_SUPPORTED_MSG } from './constants';
import { getRulesSourceName, isGrafanaRulesSource } from './datasource';
import { GRAFANA_ORIGIN_LABEL } from './labels';
import { AsyncRequestState } from './redux';
import { formatPrometheusDuration, safeParsePrometheusDuration } from './time';

/* Grafana managed rules */

function isGrafanaRulerRule(rule?: RulerRuleDTO | PostableRuleDTO): rule is RulerGrafanaRuleDTO {
  return typeof rule === 'object' && 'grafana_alert' in rule;
}

function isGrafanaAlertingRule(rule?: RulerRuleDTO): rule is RulerGrafanaRuleDTO<GrafanaAlertingRuleDefinition> {
  return isGrafanaRulerRule(rule) && !isGrafanaRecordingRule(rule);
}

function isGrafanaRecordingRule(rule?: RulerRuleDTO): rule is RulerGrafanaRuleDTO<GrafanaRecordingRuleDefinition> {
  return isGrafanaRulerRule(rule) && 'record' in rule.grafana_alert;
}

export function isPausedRule(rule: RulerGrafanaRuleDTO) {
  return Boolean(rule.grafana_alert.is_paused);
}

/* Data source managed rules */

function isAlertingRulerRule(rule?: RulerRuleDTO): rule is RulerAlertingRuleDTO {
  return typeof rule === 'object' && 'alert' in rule;
}

function isCloudRulerRule(rule?: RulerRuleDTO | PostableRuleDTO): rule is RulerCloudRuleDTO {
  return typeof rule === 'object' && !isGrafanaRulerRule(rule);
}

function isCloudRecordingRulerRule(rule?: RulerRuleDTO): rule is RulerRecordingRuleDTO {
  return typeof rule === 'object' && 'record' in rule;
}
export function isCloudRulerGroup(
  rulerRuleGroup: RulerRuleGroupDTO
): rulerRuleGroup is RulerRuleGroupDTO<RulerCloudRuleDTO> {
  return rulerRuleGroup.rules.every((r) => isCloudRulerRule(r));
}

/* Prometheus rules */

function isAlertingRule(rule?: Rule): rule is AlertingRule {
  return typeof rule === 'object' && rule.type === PromRuleType.Alerting;
}

function isRecordingRule(rule?: Rule): rule is RecordingRule {
  return typeof rule === 'object' && rule.type === PromRuleType.Recording;
}

function isGrafanaPromAlertingRule(rule?: Rule): rule is GrafanaPromAlertingRuleDTO {
  return isAlertingRule(rule) && 'folderUid' in rule && 'uid' in rule;
}

function isGrafanaPromRecordingRule(rule?: Rule): rule is GrafanaPromRecordingRuleDTO {
  return isRecordingRule(rule) && 'folderUid' in rule && 'uid' in rule;
}

export const rulerRuleType = {
  grafana: {
    rule: isGrafanaRulerRule,
    alertingRule: isGrafanaAlertingRule,
    recordingRule: isGrafanaRecordingRule,
  },
  dataSource: {
    rule: isCloudRulerRule,
    alertingRule: isAlertingRulerRule,
    recordingRule: isCloudRecordingRulerRule,
  },
  any: {
    recordingRule: (rule?: RulerRuleDTO) => isCloudRecordingRulerRule(rule) || isGrafanaRecordingRule(rule),
    alertingRule: (rule?: RulerRuleDTO) => isAlertingRulerRule(rule) || isGrafanaAlertingRule(rule),
  },
};

export const prometheusRuleType = {
  rule: (rule?: Rule) => isAlertingRule(rule) || isRecordingRule(rule),
  alertingRule: isAlertingRule,
  recordingRule: isRecordingRule,
  grafana: {
    rule: (rule?: Rule) => isGrafanaPromAlertingRule(rule) || isGrafanaPromRecordingRule(rule),
    alertingRule: isGrafanaPromAlertingRule,
    recordingRule: isGrafanaPromRecordingRule,
  },
};

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

export function isProvisionedRule(rulerRule: RulerRuleDTO): boolean {
  return isGrafanaRulerRule(rulerRule) && Boolean(rulerRule.grafana_alert.provenance);
}

export function isProvisionedPromRule(promRule: PromRuleDTO): boolean {
  return prometheusRuleType.grafana.rule(promRule) && Boolean(promRule.provenance);
}

export function isProvisionedRuleGroup(group: RulerRuleGroupDTO): boolean {
  return group.rules.some((rule) => isProvisionedRule(rule));
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

export function getRuleSource(source: string): RuleSource | undefined {
  if (source === ' grafana') {
    return RuleSource.Grafana;
  }
  return RuleSource.External;
}

export function getPendingPeriod(rule: CombinedRule): string | undefined {
  if (rulerRuleType.any.recordingRule(rule.rulerRule)) {
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

export function getPendingPeriodFromRulerRule(rule: RulerRuleDTO) {
  return rulerRuleType.any.alertingRule(rule) ? rule.for : undefined;
}

export function getKeepFiringfor(rule: CombinedRule): string | undefined {
  if (rulerRuleType.any.recordingRule(rule.rulerRule)) {
    return undefined;
  }

  if (isGrafanaAlertingRule(rule.rulerRule)) {
    return rule.rulerRule.keep_firing_for;
  }

  return undefined;
}

export function getAnnotations(rule?: AlertingRule): Annotations {
  return rule?.annotations ?? {};
}

export interface RulePluginOrigin {
  pluginId: string;
}

export function getRulePluginOrigin(rule?: Rule | PromRuleDTO | RulerRuleDTO): RulePluginOrigin | undefined {
  if (!rule) {
    return undefined;
  }

  const origin = rule.labels?.[GRAFANA_ORIGIN_LABEL];
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

export function isPluginProvidedGroup(group: RulerRuleGroupDTO): boolean {
  return group.rules.some((rule) => isPluginProvidedRule(rule));
}

export function isPluginProvidedRule(rule?: Rule | PromRuleDTO | RulerRuleDTO): boolean {
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
          acc.push({
            dataSourceName: getRulesSourceName(rulesSource),
            namespaceName,
            groupName,
            ...rule,
            namespace: { ...rule.namespace, uid: rule.promRule.folderUid },
          });
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
  [PromAlertingRuleState.Recovering]: 'warning',
  [GrafanaAlertState.Alerting]: 'bad',
  [GrafanaAlertState.Error]: 'bad',
  [GrafanaAlertState.NoData]: 'info',
  [GrafanaAlertState.Normal]: 'good',
  [GrafanaAlertState.Pending]: 'warning',
  [GrafanaAlertState.Recovering]: 'warning',
  [AlertState.NoData]: 'info',
  [AlertState.Paused]: 'warning',
  [AlertState.Alerting]: 'bad',
  [AlertState.OK]: 'good',
  // AlertState.Pending is not included because the 'pending' value is already covered by `PromAlertingRuleState.Pending`
  // [AlertState.Pending]: 'warning',
  // same for AlertState.Recovering
  // [AlertState.Recovering]: 'warning',
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
export function isFederatedRuleGroup(group: CombinedRuleGroup | RulerRuleGroupDTO): boolean {
  return Array.isArray(group.source_tenants);
}

export function getRuleName(rule: RulerRuleDTO): string {
  if (rulerRuleType.grafana.rule(rule)) {
    return rule.grafana_alert.title;
  }

  if (rulerRuleType.dataSource.alertingRule(rule)) {
    return rule.alert;
  }

  if (rulerRuleType.dataSource.recordingRule(rule)) {
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

/**
 * Calculates the number of rule evaluations before the alerting rule will fire
 * @param pendingPeriodMs - The pending period of the alerting rule in milliseconds
 * @param groupIntervalMs - The group's evaluation interval in milliseconds
 * @returns The number of rule evaluations before the rule will fire
 */
export function calcRuleEvalsToStartAlerting(pendingPeriodMs: number, groupIntervalMs: number) {
  if (pendingPeriodMs === 0) {
    return 1; // No pending period, the rule will fire immediately
  }
  if (groupIntervalMs === 0) {
    return 0; // Invalid case. Group interval is never 0. The default interval will be used.
  }

  const evaluationsBeforeCeil = pendingPeriodMs / groupIntervalMs;
  return evaluationsBeforeCeil < 1 ? 0 : Math.ceil(pendingPeriodMs / groupIntervalMs) + 1;
}

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

export function isGrafanaRecordingRuleByType(type?: RuleFormType) {
  return type === RuleFormType.grafanaRecording;
}

export function isCloudAlertingRuleByType(type?: RuleFormType) {
  return type === RuleFormType.cloudAlerting;
}

export function isCloudRecordingRuleByType(type?: RuleFormType) {
  return type === RuleFormType.cloudRecording;
}

export function isGrafanaManagedRuleByType(type?: RuleFormType) {
  return isGrafanaAlertingRuleByType(type) || isGrafanaRecordingRuleByType(type);
}

export function isRecordingRuleByType(type?: RuleFormType) {
  return isGrafanaRecordingRuleByType(type) || isCloudRecordingRuleByType(type);
}

export function isDataSourceManagedRuleByType(type?: RuleFormType) {
  return isCloudAlertingRuleByType(type) || isCloudRecordingRuleByType(type);
}

/*
 * Grab the UID from either a rulerRule definition or a Prometheus rule definition, only Grafana-managed rules will have a UID.
 */
export function getRuleUID(rule?: RulerRuleDTO | Rule) {
  if (!rule) {
    return;
  }

  let ruleUid: string | undefined;

  if ('grafana_alert' in rule && rulerRuleType.grafana.rule(rule)) {
    ruleUid = rule.grafana_alert.uid;
  } else if ('uid' in rule && prometheusRuleType.grafana.rule(rule)) {
    ruleUid = rule.uid;
  }

  return ruleUid;
}

/* Prometheus internal models */

import { AlertState, DataSourceInstanceSettings } from '@grafana/data';
import { PromOptions } from '@grafana/prometheus';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { LokiOptions } from 'app/plugins/datasource/loki/types';

import {
  Annotations,
  GrafanaAlertState,
  GrafanaAlertStateWithReason,
  Labels,
  mapStateWithReasonToBaseState,
  PromAlertingRuleState,
  PromRuleType,
  RulerRuleDTO,
  RulerRuleGroupDTO,
} from './unified-alerting-dto';

export type Alert = {
  activeAt: string;
  annotations: { [key: string]: string };
  labels: { [key: string]: string };
  state: Exclude<PromAlertingRuleState | GrafanaAlertStateWithReason, PromAlertingRuleState.Inactive>;
  value: string;
};

export function hasAlertState(alert: Alert, state: PromAlertingRuleState | GrafanaAlertState): boolean {
  return mapStateWithReasonToBaseState(alert.state) === state;
}

// Prometheus API uses "err" but grafana API uses "error" *sigh*
export type RuleHealth = 'nodata' | 'error' | 'err' | string;

interface RuleBase {
  health: RuleHealth;
  name: string;
  query: string;
  lastEvaluation?: string;
  evaluationTime?: number;
  lastError?: string;
}

export interface AlertingRule extends RuleBase {
  alerts?: Alert[];
  labels?: {
    [key: string]: string;
  };
  annotations?: {
    [key: string]: string;
  };
  state: PromAlertingRuleState;
  type: PromRuleType.Alerting;

  /**
   * Pending period in seconds, aka for. 0 or undefined means no pending period
   */
  duration?: number;
  totals?: Partial<Record<Lowercase<GrafanaAlertState>, number>>;
  totalsFiltered?: Partial<Record<Lowercase<GrafanaAlertState>, number>>;
  activeAt?: string; // ISO timestamp
}

export interface RecordingRule extends RuleBase {
  type: PromRuleType.Recording;

  labels?: {
    [key: string]: string;
  };
}

export type Rule = AlertingRule | RecordingRule;

export type BaseRuleGroup = { name: string };

type TotalsWithoutAlerting = Exclude<AlertInstanceTotalState, AlertInstanceTotalState.Alerting>;
enum FiringTotal {
  Firing = 'firing',
}
export interface RuleGroup {
  name: string;
  interval: number;
  rules: Rule[];
  // totals only exist for Grafana Managed rules
  totals?: Partial<Record<TotalsWithoutAlerting | FiringTotal, number>>;
}

export interface RuleNamespace {
  dataSourceName: string;
  name: string;
  groups: RuleGroup[];
}

export interface RulesSourceResult {
  dataSourceName: string;
  error?: unknown;
  namespaces?: RuleNamespace[];
}

/** @deprecated use RulesSourceIdentifier instead */
export type RulesSource = DataSourceInstanceSettings<PromOptions | LokiOptions> | 'grafana';

// combined prom and ruler result
export interface CombinedRule {
  name: string;
  query: string;
  labels: Labels;
  annotations: Annotations;
  promRule?: Rule;
  rulerRule?: RulerRuleDTO;
  group: CombinedRuleGroup;
  namespace: CombinedRuleNamespace;
  instanceTotals: AlertInstanceTotals;
  filteredInstanceTotals: AlertInstanceTotals;
}

// export type AlertInstanceState = PromAlertingRuleState | 'nodata' | 'error';
export enum AlertInstanceTotalState {
  Alerting = 'alerting',
  Pending = 'pending',
  Normal = 'inactive',
  NoData = 'nodata',
  Error = 'error',
}

export type AlertInstanceTotals = Partial<Record<AlertInstanceTotalState, number>>;

// AlertGroupTotals also contain the amount of recording and paused rules
export type AlertGroupTotals = Partial<Record<AlertInstanceTotalState | 'paused' | 'recording', number>>;

export interface CombinedRuleGroup {
  name: string;
  interval?: string;
  source_tenants?: string[];
  rules: CombinedRule[];
  totals: AlertGroupTotals;
}

export interface CombinedRuleNamespace {
  rulesSource: RulesSource;
  name: string;
  groups: CombinedRuleGroup[];
  uid?: string; //available only in grafana rules
}

export interface RuleWithLocation<T = RulerRuleDTO> {
  ruleSourceName: string;
  namespace: string;
  namespace_uid?: string; // Grafana folder UID
  group: RulerRuleGroupDTO;
  rule: T;
}

export const GrafanaRulesSourceSymbol = Symbol('grafana');
export type RulesSourceUid = string | typeof GrafanaRulesSourceSymbol;

export interface ExternalRulesSourceIdentifier {
  uid: string;
  name: string;
}
export interface GrafanaRulesSourceIdentifier {
  uid: typeof GrafanaRulesSourceSymbol;
  name: typeof GRAFANA_RULES_SOURCE_NAME;
}

export type RulesSourceIdentifier = ExternalRulesSourceIdentifier | GrafanaRulesSourceIdentifier;

/** @deprecated use RuleGroupIdentifierV2 instead */
export interface RuleGroupIdentifier {
  dataSourceName: string;
  /** ⚠️ use the Grafana folder UID for Grafana-managed rules */
  namespaceName: string;
  groupName: string;
}

export interface GrafanaNamespaceIdentifier {
  uid: string;
}

export interface DataSourceNamespaceIdentifier {
  name: string;
}

export interface GrafanaRuleGroupIdentifier {
  rulesSource: GrafanaRulesSourceIdentifier;
  groupName: string;
  namespace: GrafanaNamespaceIdentifier;
  groupOrigin: 'grafana';
}

export interface DataSourceRuleGroupIdentifier {
  rulesSource: ExternalRulesSourceIdentifier;
  groupName: string;
  namespace: DataSourceNamespaceIdentifier;
  groupOrigin: 'datasource';
}

export type RuleGroupIdentifierV2 = GrafanaRuleGroupIdentifier | DataSourceRuleGroupIdentifier;

export type CombinedRuleWithLocation = CombinedRule & RuleGroupIdentifier;

export interface PromRuleWithLocation {
  rule: AlertingRule;
  dataSourceName: string;
  namespaceName: string;
  groupName: string;
}

export interface CloudRuleIdentifier {
  ruleSourceName: string;
  namespace: string;
  groupName: string;
  ruleName: string;
  rulerRuleHash: string;
}
export interface GrafanaRuleIdentifier {
  ruleSourceName: 'grafana';
  uid: string;
}

// Rule read directly from Prometheus without existing in the ruler API
export interface PrometheusRuleIdentifier {
  ruleSourceName: string;
  namespace: string;
  groupName: string;
  ruleName: string;
  ruleHash: string;
}

export type RuleIdentifier = EditableRuleIdentifier | PrometheusRuleIdentifier;

/**
 * This type is a union of all rule identifiers that should have a ruler API
 *
 * We do not support PrometheusRuleIdentifier because vanilla Prometheus has no ruler API
 */
export type EditableRuleIdentifier = CloudRuleIdentifier | GrafanaRuleIdentifier;

export interface FilterState {
  queryString?: string;
  dataSource?: string;
  alertState?: string;
  groupBy?: string[];
  ruleType?: string;
}

export interface SilenceFilterState {
  queryString?: string;
  silenceState?: string;
}

interface EvalMatch {
  metric: string;
  tags?: Record<string, string>;
  value: number;
}

export interface StateHistoryItemData {
  noData?: boolean;
  evalMatches?: EvalMatch[];
}

export interface StateHistoryItem {
  id: number;
  alertId: number;
  alertName: string;
  dashboardId: number;
  panelId: number;
  userId: number;
  newState: AlertState;
  prevState: AlertState;
  created: number;
  updated: number;
  time: number;
  timeEnd: number;
  text: string;
  tags: string[];
  login: string;
  email: string;
  avatarUrl: string;
  data: StateHistoryItemData;
}

export interface RulerDataSourceConfig {
  dataSourceName: string;
  apiVersion: 'legacy' | 'config';
}

export interface PromBasedDataSource {
  name: string;
  id: string | number;
  rulerConfig?: RulerDataSourceConfig;
}

export interface PaginationProps {
  itemsPerPage: number;
}

import { Annotations, Labels } from '../../common';
import { PrometheusSuccessResponse } from '../api';

/**
 * RuleHealth
 */
type RuleHealth = 'ok' | 'unknown' | 'error';

/**
 * Rule
 * * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L168-L187
 */
interface GenericPrometheusRule {
  uid: string;
  name: string;
  folderUid: string;
  query: string;
  labels: Labels;
  health: RuleHealth;
  lastError?: string;
  lastEvaluation: string; // ISO date string
  evaluationTime: number; // milliseconds
}

/**
 * RecordingRule
 */
export interface PrometheusRecordingRule extends GenericPrometheusRule {
  alerts?: never; // recording rule can't have alerts
  type: 'recording';
}

/**
 * AlertingRule
 * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L146-L166
 */
export interface PrometheusAlertingRule extends GenericPrometheusRule {
  state: RuleState;
  duration?: number;
  keepFiringFor?: number;
  annotations: Annotations;
  activeAt?: string; // ISO date string
  alerts: PrometheusAlert[];
  totals?: Totals<Lowercase<AlertStateWithoutReason>>;
  totalsFiltered?: Totals<Lowercase<AlertStateWithoutReason>>;
  type: 'alerting';
}

export type PrometheusRule = PrometheusRecordingRule | PrometheusAlertingRule;

/**
 * Rule Group response for listing Prometheus rule groups
 * /api/v1/rules
 */
export type PrometheusRuleGroupResponse = PrometheusSuccessResponse<{
  groups: PrometheusRuleGroup[];
  groupNextToken?: string; // for paginated API responses
}>;

/*
 * RuleGroup
 * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L86-L104
 */
export interface PrometheusRuleGroup {
  name: string;
  file: string;
  folderUid: string;
  rules: PrometheusRule[];
  totals?: Totals<RuleState>;
  interval: number;
  lastEvaluation: string; // ISO date string
  evaluationTime: number; // milliseconds
}

/*
 * Alert
 * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L189-L201
 */
export interface PrometheusAlert {
  labels: Labels;
  annotations: Annotations;
  state: AlertStateWithoutReason | AlertStateWithReason;
  activeAt: string; // ISO timestamp
  value: string;
}

// ⚠️ do NOT confuse rule state with alert state
export type RuleState = 'inactive' | 'pending' | 'firing';
export type AlertStateWithoutReason = 'Normal' | 'Alerting' | 'Pending' | 'NoData' | 'Error';
export type AlertStateWithReason = AlertStateWithoutReason | `${AlertStateWithoutReason} (${StateReason})`;

// StateReason
// https://github.com/grafana/grafana/blob/4d6f9900ecc683796512ce2bfd49fbc92a78d66d/pkg/services/ngalert/models/alert_rule.go#L165-L173
enum StateReason {
  StateReasonMissingSeries = 'MissingSeries',
  StateReasonNoData = 'NoData',
  StateReasonError = 'Error',
  StateReasonPaused = 'Paused',
  StateReasonUpdated = 'Updated',
  StateReasonRuleDeleted = 'RuleDeleted',
  StateReasonKeepLast = 'KeepLast',
}

type Totals<Key extends string> = Partial<Record<Key, number>>;

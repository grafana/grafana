import { SuccessResponse } from '../../common/api';
import { Annotations, Labels } from '../../common/rules';

/**
 * RuleHealth
 */
type RuleHealth = 'ok' | 'unknown' | 'error';

/**
 * Rule
 * * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L168-L187
 */
interface BaseRule {
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
export interface RecordingRule extends BaseRule {
  type: 'recording';
}

/**
 * AlertingRule
 * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L146-L166
 */
export interface AlertingRule extends BaseRule {
  state: RuleState;
  duration?: number;
  keepFiringFor?: number;
  annotations: Annotations;
  activeAt?: string; // ISO date string
  alerts: AlertInstance[];
  totals?: Totals<Lowercase<AlertStateWithoutReason>>;
  totalsFiltered?: Totals<Lowercase<AlertStateWithoutReason>>;
  type: 'alerting';
}

export type Rule = RecordingRule | AlertingRule;

/**
 * Rule Group response for listing Prometheus rule groups
 * /api/v1/rules
 */
export type RuleGroupResponse = SuccessResponse<{
  groups: RuleGroup[];
  groupNextToken?: string; // for paginated API responses
}>;

/*
 * RuleGroup
 * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L86-L104
 */
export interface RuleGroup {
  name: string;
  file: string;
  folderUid: string;
  rules: Rule[];
  totals?: Totals<RuleState>;
  interval: number;
  lastEvaluation: string; // ISO date string
  evaluationTime: number; // milliseconds
}

/*
 * Alert
 * https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L189-L201
 */
export interface AlertInstance {
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
type StateReason = 'MissingSeries' | 'NoData' | 'Error' | 'Paused' | 'Updated' | 'RuleDeleted' | 'KeepLast';

type Totals<Key extends string> = Partial<Record<Key, number>>;

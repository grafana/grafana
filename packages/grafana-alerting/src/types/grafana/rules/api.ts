import { SuccessResponse } from '../../common/api';
import { Annotations, Labels } from '../../common/rules';

/**
 * Rule health in Grafana-flavored Prometheus indicates the evaluation status of a rule, which can be "ok", "unknown", or "error".
 */
type RuleHealth = 'ok' | 'unknown' | 'error';

/**
 * Base rule object shared between alerting and recording rules
 * @see {@link https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L168-L187|source}
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
 * A Prometheus recording rule evaluates an expression at regular intervals and stores the result as a new time series for efficient querying.
 * @see {@link https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L170-L187|source}
 */
export interface RecordingRule extends BaseRule {
  type: 'recording';
}

/**
 * A Prometheus alerting rule evaluates an expression at regular intervals and triggers an alert when a specified condition is met for a defined duration.
 * @see {@link https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L146-L166|source}
 */
export interface AlertingRule extends BaseRule {
  state: RuleState;
  duration?: number;
  keepFiringFor?: number;
  annotations: Annotations;
  activeAt?: string; // ISO date string
  alerts: AlertInstance[];
  totals?: Totals<Lowercase<AlertInstanceStateWithoutReason>>;
  totalsFiltered?: Totals<Lowercase<AlertInstanceStateWithoutReason>>;
  type: 'alerting';
}

/**
 * A Prometheus rule, which can be either an alerting rule that triggers alerts based on conditions or a recording rule that stores computed time series for efficient queries.
 */
export type Rule = RecordingRule | AlertingRule;

/**
 * A rule group response in Prometheus API contains metadata and evaluation results for a group of alerting and recording rules, including their evaluation interval, health status, and individual rule details.
 * @description Response from the /api/v1/rules endpoint
 * @see {@link https://github.com/prometheus/prometheus/blob/34bed4608b4b1518e81e68f8690f6caad16c8bf9/web/api/v1/api.go#L1418-L1422|source}
 */
export type RuleGroupResponse = SuccessResponse<{
  groups: RuleGroup[];
  groupNextToken?: string; // for paginated API responses
}>;

/**
 * A Prometheus rule group is a collection of alerting and recording rules that are evaluated at a shared interval.
 * @see {@link https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L86-L104|source}
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

/**
 * An alert instance represents the state of an alerting rule evaluation, containing details such as labels, annotations, active time, and status.
 * A single alerting rule can generate multiple alerts if the rule expression matches multiple time series.
 * @see {@link https://github.com/grafana/grafana/blob/55f28124665e73f0ced273f854fe1eabfe225a8c/pkg/services/ngalert/api/tooling/definitions/prom.go#L189-L201|source}
 */
export interface AlertInstance {
  labels: Labels;
  annotations: Annotations;
  state: AlertInstanceState;
  activeAt: string; // ISO timestamp
  value: string;
}

// ⚠️ do NOT confuse rule state with alert state
export type RuleState = 'inactive' | 'pending' | 'firing';
export type AlertInstanceState = AlertInstanceStateWithoutReason | AlertInstanceStateWithReason;
export type AlertInstanceStateWithoutReason = 'Normal' | 'Alerting' | 'Pending' | 'NoData' | 'Error';
export type AlertInstanceStateWithReason = `${AlertInstanceStateWithoutReason} (${StateReason})`;

/**
 * A Grafana state reason explains why an alert is in a particular state, providing additional context.
 * @see {@link https://github.com/grafana/grafana/blob/4d6f9900ecc683796512ce2bfd49fbc92a78d66d/pkg/services/ngalert/models/alert_rule.go#L165-L173|source}
 */
type StateReason = 'MissingSeries' | 'NoData' | 'Error' | 'Paused' | 'Updated' | 'RuleDeleted' | 'KeepLast';

type Totals<Key extends string> = Partial<Record<Key, number>>;

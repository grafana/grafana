import { SuccessResponse } from '../../common/api';
import { Annotations, Labels } from '../../common/rules';

/**
 * Rule health in Grafana-flavored Prometheus indicates the evaluation status of a rule, which can be "ok", "unknown", or "error".
 * @see {@link https://github.com/prometheus/prometheus/blob/bd5b2ea95ce14fba11db871b4068313408465207/rules/rule.go#L29-L34|source}
 */
export type RuleHealth = 'ok' | 'unknown' | 'err';

/**
 * Base rule object shared between alerting and recording rules
 */
interface BaseRule {
  name: string;
  query: string;
  labels: Labels;
  health: RuleHealth;
  lastError?: string; // Only present if health === "err"
  evaluationTime: number; // milliseconds
  lastEvaluation: string; // ISO date string
}

/**
 * A Prometheus recording rule evaluates an expression at regular intervals and stores the result as a new time series for efficient querying.
 * @see {@link https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1458-L1468|source}
 */
export interface RecordingRule extends BaseRule {
  type: 'recording';
}

/**
 * A Prometheus alerting rule evaluates an expression at regular intervals and triggers an alert when a specified condition is met for a defined duration.
 * @see {@link https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1440-L1456|source}
 */
export interface AlertingRule extends BaseRule {
  type: 'alerting';
  state: AlertRuleState;
  duration: number; // pending period (also know as "for") in seconds
  annotations: Annotations;
  alerts: AlertInstance[];
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
  groupNextToken?: string; // for paginated API responses, requires Prometheus v3.1.0+
}>;

/**
 * A Prometheus rule group is a collection of alerting and recording rules that are evaluated at a shared interval.
 * @see {@link https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1424-L1436|source}
 */
export interface RuleGroup {
  name: string;
  file: string;
  rules: Rule[];
  interval: number;
  limit?: number;

  evaluationTime: number; // milliseconds
  lastEvaluation: string; // ISO date string
}

/**
 * An alert instance represents the state of an alerting rule evaluation, containing details such as labels, annotations, active time, and status.
 * A single alerting rule can generate multiple alerts if the rule expression matches multiple time series.
 * @see {@link https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1301-L1309|source}
 */
export interface AlertInstance {
  labels: Labels;
  annotations?: Annotations;
  state: AlertInstanceState;
  activeAt?: string; // ISO timestamp
  keepFiringSince?: string; // ISO timestamp
  value: string;
}

// ⚠️ do NOT confuse rule state with alert state
export type AlertRuleState = 'inactive' | 'pending' | 'firing';
export type AlertInstanceState = 'inactive' | 'pending' | 'firing';

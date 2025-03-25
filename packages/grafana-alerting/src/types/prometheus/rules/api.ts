import { Annotations, Labels } from '../../common/rules';
import { SuccessResponse as SuccessResponse } from '../api';

/**
 * RuleHealth
 * https://github.com/prometheus/prometheus/blob/bd5b2ea95ce14fba11db871b4068313408465207/rules/rule.go#L29-L34
 */
export type RuleHealth = 'ok' | 'unknown' | 'err';

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
 * RecordingRule
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1458-L1468
 */
export interface RecordingRule extends BaseRule {
  type: 'recording';
}

/**
 * AlertingRule
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1440-L1456
 */
export interface AlertingRule extends BaseRule {
  type: 'alerting';
  state: AlertRuleState;
  duration: number; // pending period (also know as "for") in seconds
  annotations: Annotations;
  alerts: AlertInstance[];
}

export type Rule = RecordingRule | AlertingRule;

/**
 * Rule Group response for listing Prometheus rule groups
 * /api/v1/rules
 */
export type RuleGroupResponse = SuccessResponse<{
  groups: RuleGroup[];
  groupNextToken?: string; // for paginated API responses, requires Prometheus v3.1.0+
}>;

/*
 * RuleGroup
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1424-L1436
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

/*
 * Alert
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1301-L1309
 */
export interface AlertInstance {
  labels: Labels;
  annotations?: Annotations;
  state: AlertInstanceState;
  activeAt?: string; // ISO timestamp
  keepFiringSince?: string; // ISO timestamp
  value: string;
}

export type AlertRuleState = 'inactive' | 'pending' | 'firing';
export type AlertInstanceState = 'inactive' | 'pending' | 'firing';

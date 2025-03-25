import { Annotations, Labels } from '../../common';
import { PrometheusSuccessResponse } from '../api';

/**
 * RuleHealth
 * https://github.com/prometheus/prometheus/blob/bd5b2ea95ce14fba11db871b4068313408465207/rules/rule.go#L29-L34
 */
export type RuleHealth = 'ok' | 'unknown' | 'err';

interface BasePrometheusRule {
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
export interface PrometheusRecordingRule extends BasePrometheusRule {
  type: 'recording';
}

/**
 * AlertingRule
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1440-L1456
 */
export interface PrometheusAlertingRule extends BasePrometheusRule {
  type: 'alerting';
  state: RuleState;
  duration: number; // pending period (also know as "for") in seconds
  annotations: Annotations;
  alerts: PrometheusAlert[];
}

export type PrometheusRule = PrometheusRecordingRule | PrometheusAlertingRule;

/**
 * Rule Group response for listing Prometheus rule groups
 * /api/v1/rules
 */
export type PrometheusRuleGroupResponse = PrometheusSuccessResponse<{
  groups: PrometheusRuleGroup[];
  groupNextToken?: string; // for paginated API responses, requires Prometheus v3.1.0+
}>;

/*
 * RuleGroup
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1424-L1436
 */
export interface PrometheusRuleGroup {
  name: string;
  file: string;
  rules: PrometheusRule[];
  interval: number;
  limit?: number;

  evaluationTime: number; // milliseconds
  lastEvaluation: string; // ISO date string
}

/*
 * Alert
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/web/api/v1/api.go#L1301-L1309
 */
export interface PrometheusAlert {
  labels: Labels;
  annotations?: Annotations;
  state: AlertState;
  activeAt?: string; // ISO timestamp
  keepFiringSince?: string; // ISO timestamp
  value: string;
}

export type RuleState = 'inactive' | 'pending' | 'firing';
export type AlertState = 'inactive' | 'pending' | 'firing';

import { Annotations, Labels } from '../common';

export interface PrometheusRuleGroup<T = PrometheusRule> {
  name: string;
  file: string;
  rules: T[];
  interval: number;
  // this is the maximum number of rules that can be evaluated in a single evaluation cycle
  limit?: number; // 0 = infinite

  // these 2 are not in older prometheus payloads
  evaluationTime?: number; // milliseconds
  lastEvaluation?: string; // ISO date string
}

/** Recording rules store computed expressions as new time series */
export interface PrometheusRecordingRule {
  record: string; // Name of the new time series
  expr: string; // PromQL expression
  labels?: Labels;
}

/** Alerting rules trigger alerts based on conditions */
export interface PrometheusAlertingRule {
  alert: string; // Alert name
  expr: string; // PromQL expression
  for?: string; // Duration before the alert triggers (e.g., "5m")
  labels?: Labels;
  annotations?: Annotations; // Metadata like descriptions or summaries
}

export type PrometheusRule = PrometheusRecordingRule | PrometheusAlertingRule;

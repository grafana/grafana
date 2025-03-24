import { Annotations, Labels } from '../../common';

/**
 * --- alerting and recording rules ---
 */

export type PrometheusRuleDefinition = PrometheusRecordingRuleDefinition | PrometheusAlertingRuleDefinition;

interface BaseRuleDefinition {
  expr: string;
  labels?: Labels;
}

/** Recording rules store computed expressions as new time series */
export interface PrometheusRecordingRuleDefinition extends BaseRuleDefinition {
  record: string; // Name of the new time series
  alert?: never;
}

/** Alerting rules trigger alerts based on conditions */
export interface PrometheusAlertingRuleDefinition {
  alert: string; // Alert name
  for?: string; // Duration before the alert triggers (e.g., "5m")
  annotations?: Annotations; // Metadata like descriptions or summaries
  record?: never;
}

/**
 * Rule group definitions (YAML)
 * https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/model/rulefmt/rulefmt.go#L151-L159
 */
export interface PrometheusRuleGroupDefinition<RuleDefinition = PrometheusRuleDefinition> {
  name: string;
  interval?: string;
  query_offset?: string;
  limit?: number; // this is the maximum number of rules that can be evaluated in a single evaluation cycle; 0 = infinite
  rules: RuleDefinition[];
  Labels?: Labels;
}

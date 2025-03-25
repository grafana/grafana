import { Annotations, Labels } from '../../common/rules';

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
export interface PrometheusAlertingRuleDefinition extends BaseRuleDefinition {
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
  // rule can produce. 0 is no limit.
  name: string;
  // How often rules in the group are evaluated.
  interval?: string; // <duration> | default = global.evaluation_interval
  // Offset the rule evaluation timestamp of this particular group by the specified duration into the past.
  query_offset?: string; // <duration> | default = global.rule_query_offset
  // Limit the number of alerts an alerting rule and series a recording rule can produce. 0 is no limit.
  limit?: number; // default = 0
  // Labels to add or overwrite before storing the result for its rules.
  // Labels defined in <rule> will override the key if it has a collision.
  labels?: Labels; // <labelname>: <labelvalue>
  rules: RuleDefinition[];
}

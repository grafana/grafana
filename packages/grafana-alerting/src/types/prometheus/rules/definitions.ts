import { Annotations, Labels } from '../../common/rules';

export type RuleDefinition = RecordingRuleDefinition | AlertingRuleDefinition;

/**
 * Base rule definition shared between alerting and recording rules
 * @see {@link https://github.com/prometheus/prometheus/blob/7d73c1d3f80b724a58975b5699a54f181118384a/model/rulefmt/rulefmt.go#L172-L181|source}
 */
interface BaseRuleDefinition {
  expr: string;
  labels?: Labels;
}

/** Recording rules store computed expressions as new time series */
export interface RecordingRuleDefinition extends BaseRuleDefinition {
  record: string; // Name of the new time series
}

/** Alerting rules trigger alerts based on conditions */
export interface AlertingRuleDefinition extends BaseRuleDefinition {
  alert: string; // Alert name
  for?: string; // Duration before the alert triggers (e.g., "5m")
  annotations?: Annotations; // Metadata like descriptions or summaries
}

/**
 * Rule group definitions (YAML)
 * @see {@link https://github.com/prometheus/prometheus/blob/475092ff79741aed3d28594662876fca02b9553c/model/rulefmt/rulefmt.go#L151-L159|source}
 */
export interface RuleGroupDefinition<RuleType = RuleDefinition> {
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
  rules: RuleType[];
}

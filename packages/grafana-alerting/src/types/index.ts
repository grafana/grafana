import type * as GrafanaFlavor from '@grafana/alerting/src/types/grafana/rules/api';
import type * as VanillaFlavor from '@grafana/alerting/src/types/prometheus/rules/api';

/**
 * RuleGroup response from either the Grafana API endpoint or a vanilla prometheus API endpoint
 */
export type PrometheusRuleGroupResponse =
  | GrafanaFlavor.PrometheusRuleGroupResponse
  | VanillaFlavor.PrometheusRuleGroupResponse;

export type PrometheusRuleGroup = GrafanaFlavor.PrometheusRuleGroup | VanillaFlavor.PrometheusRuleGroup;

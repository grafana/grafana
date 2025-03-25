import { GrafanaAPI, PrometheusAPI } from '../index';

/**
 * RuleGroup response from either the Grafana API endpoint or a vanilla prometheus API endpoint
 */
export type RuleGroupResponse = GrafanaAPI.RuleGroupResponse | PrometheusAPI.RuleGroupResponse;

export type RuleGroup = GrafanaAPI.RuleGroup | PrometheusAPI.RuleGroup;
export type Rule = GrafanaAPI.Rule | PrometheusAPI.Rule;
export type AlertingRule = GrafanaAPI.AlertingRule | PrometheusAPI.AlertingRule;
export type RecordingRule = GrafanaAPI.RecordingRule | PrometheusAPI.RecordingRule;
export type AlertInstance = GrafanaAPI.AlertInstance | PrometheusAPI.AlertInstance;

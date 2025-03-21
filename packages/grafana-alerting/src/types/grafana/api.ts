import { PrometheusApiResponse } from '../prometheus/api';

import { GrafanaPrometheusRuleGroup } from './rules';

/**
 * Rule Group response for listing Prometheus rule groups
 * /api/v1/rules
 */
export type PrometheusApiRuleGroupResponse = PrometheusApiResponse<{
  groups: GrafanaPrometheusRuleGroup[];
  groupNextToken?: string; // for paginated API responses
}>;

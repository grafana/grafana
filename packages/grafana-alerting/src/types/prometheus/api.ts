import { PrometheusRuleGroup } from './rules';

/* Success response */
export interface PrometheusSuccessResponse<T> {
  status: 'success';
  data: T;
}

/* Error response */
export interface PrometheusErrorResponse {
  status: 'error';
  errorType: string;
  error: string;
}

/* API response (Success or Error) */
export type PrometheusApiResponse<T> = PrometheusSuccessResponse<T> | PrometheusErrorResponse;

/**
 * Rule Group response for listing Prometheus rule groups
 * /api/v1/rules
 */
export type PrometheusApiRuleGroupResponse = PrometheusApiResponse<{
  groups: PrometheusRuleGroup[];
  groupNextToken?: string; // for paginated API responses
}>;

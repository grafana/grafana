import { VAR_METRIC_EXPR, VAR_FILTERS_EXPR, VAR_OTEL_JOIN_QUERY_EXPR } from 'app/features/trails/shared';

const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}`;
const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(rate: boolean) {
  return rate
    ? `${GENERAL_RATE_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`
    : `${GENERAL_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`;
}

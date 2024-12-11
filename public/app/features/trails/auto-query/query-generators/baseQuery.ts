import { VAR_METRIC_EXPR, VAR_FILTERS_WITH_CURLY_EXPR, VAR_OTEL_JOIN_QUERY_EXPR } from '../../shared';

const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_WITH_CURLY_EXPR}`;
const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(rate: boolean) {
  return rate
    ? `${GENERAL_RATE_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`
    : `${GENERAL_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`;
}


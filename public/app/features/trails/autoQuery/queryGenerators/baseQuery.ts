import { VAR_FILTERS_EXPR, VAR_FILTERS_WITH_CURLY_EXPR, VAR_METRIC_EXPR, VAR_OTEL_JOIN_QUERY_EXPR } from '../../shared';

const BASE_QUERY_TEMPLATE = `${VAR_METRIC_EXPR}${VAR_FILTERS_WITH_CURLY_EXPR}`;
const RATE_BASE_QUERY_TEMPLATE = `rate(${BASE_QUERY_TEMPLATE}[$__rate_interval])`;

const BASE_QUERY_UTF8_METRIC_TEMPLATE = `{${VAR_METRIC_EXPR}, ${VAR_FILTERS_EXPR}}`;
const RATE_BASE_QUERY_UTF8_METRIC_TEMPLATE = `rate(${BASE_QUERY_UTF8_METRIC_TEMPLATE}[$__rate_interval])`;

export function generateBaseQuery({
  isRateQuery = false,
  groupings = [],
  aggregation = '',
  isUtf8Metric = false,
}: {
  isRateQuery?: boolean;
  groupings?: string[];
  aggregation?: string;
  isUtf8Metric?: boolean;
}): string {
  // Determine base query template
  const baseQuery = isUtf8Metric
    ? isRateQuery
      ? RATE_BASE_QUERY_UTF8_METRIC_TEMPLATE
      : BASE_QUERY_UTF8_METRIC_TEMPLATE
    : isRateQuery
      ? RATE_BASE_QUERY_TEMPLATE
      : BASE_QUERY_TEMPLATE;

  // Apply aggregation (e.g., sum, avg) if provided
  const aggregatedQuery = aggregation ? `${aggregation} (${baseQuery})` : baseQuery;

  // Apply groupings (e.g., `sum by(le, instance)`)
  if (groupings.length > 0) {
    return `sum by(${groupings.join(', ')}) (${aggregatedQuery}) ${VAR_OTEL_JOIN_QUERY_EXPR}`;
  }

  return `${aggregatedQuery} ${VAR_OTEL_JOIN_QUERY_EXPR}`;
}

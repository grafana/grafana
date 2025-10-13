import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR, VAR_OTEL_JOIN_QUERY_EXPR } from '../../shared';

// For usual non-utf8-metrics we use filters in the curly braces
// metric_name{filter_label="filter_value"}
const BASE_QUERY_TEMPLATE = `${VAR_METRIC_EXPR}{${VAR_FILTERS_EXPR}}`;
const RATE_BASE_QUERY_TEMPLATE = `rate(${BASE_QUERY_TEMPLATE}[$__rate_interval])`;

// For utf8 metrics we need to put the metric name inside curly braces with filters
// {"utf8.metric", filter_label="filter_val"}
const BASE_QUERY_UTF8_METRIC_TEMPLATE = `{"${VAR_METRIC_EXPR}", ${VAR_FILTERS_EXPR}}`;
const RATE_BASE_QUERY_UTF8_METRIC_TEMPLATE = `rate(${BASE_QUERY_UTF8_METRIC_TEMPLATE}[$__rate_interval])`;

export function generateBaseQuery({
  isRateQuery = false,
  groupings = [],
  isUtf8Metric = false,
}: {
  isRateQuery?: boolean;
  groupings?: string[];
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

  // Apply groupings (e.g., `sum by(le, instance)`)
  if (groupings.length > 0) {
    return `sum by(${groupings.join(', ')}) (${baseQuery} ${VAR_OTEL_JOIN_QUERY_EXPR})`;
  }

  return `${baseQuery} ${VAR_OTEL_JOIN_QUERY_EXPR}`;
}

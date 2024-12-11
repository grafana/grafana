import {
  VAR_METRIC_EXPR,
  VAR_FILTERS_WITH_CURLY_EXPR,
  VAR_OTEL_JOIN_QUERY_EXPR,
  VAR_GROUP_BY_EXP,
  VAR_FILTERS_EXPR,
} from '../shared';

import { generateCommonAutoQueryInfo } from './queryGenerators/common';
import { createHistogramMetricQueryDefs } from './queryGenerators/histogram';
import { createSummaryMetricQueryDefs } from './queryGenerators/summary';
import { AutoQueryContext, AutoQueryInfo } from './types';
import { getPerSecondRateUnit, getUnit } from './units';

const BASE_QUERY_TEMPLATE = `${VAR_METRIC_EXPR}${VAR_FILTERS_WITH_CURLY_EXPR}`;
const RATE_BASE_QUERY_TEMPLATE = `rate(${BASE_QUERY_TEMPLATE}[$__rate_interval])`;

const BASE_QUERY_UTF8_METRIC_TEMPLATE = `{${VAR_METRIC_EXPR}, ${VAR_FILTERS_EXPR}}`;
const RATE_BASE_QUERY_UTF8_METRIC_TEMPLATE = `rate(${BASE_QUERY_UTF8_METRIC_TEMPLATE}[$__rate_interval])`;

const RATE_SUFFIXES = new Set(['count', 'total']);
const UNSUPPORTED_SUFFIXES = new Set(['sum', 'bucket']);
const SPECIFIC_AGGREGATIONS_FOR_SUFFIX: Record<string, string> = {
  count: 'sum',
  total: 'sum',
};
const aggLabels: Record<string, string> = {
  avg: 'average',
  sum: 'overall',
};

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

export function getAutoQueriesForMetric(metric: string): AutoQueryInfo {
  const metricParts = metric.split('_');
  const suffix = metricParts.at(-1);
  const unitSuffix = suffix === 'total' ? metricParts.at(-2) : suffix;

  // Handle special cases: summary and histogram
  if (suffix === 'sum') {
    return createSummaryMetricQueryDefs(createContext(metricParts, { isRateQuery: true }));
  }
  if (suffix === 'bucket') {
    return createHistogramMetricQueryDefs(createContext(metricParts));
  }

  // If the suffix is null or is in the set of unsupported suffixes, throw an error because the metric should be delegated to a different generator (summary or histogram)
  if (suffix == null || UNSUPPORTED_SUFFIXES.has(suffix)) {
    throw new Error(`This function does not support a metric suffix of "${suffix}"`);
  }

  // Determine query type and unit
  const isRateQuery = RATE_SUFFIXES.has(suffix);
  const aggregation = SPECIFIC_AGGREGATIONS_FOR_SUFFIX[suffix] || 'avg';
  const unit = isRateQuery ? getPerSecondRateUnit(unitSuffix) : getUnit(unitSuffix);

  // Generate base query and descriptions
  const baseQuery = generateBaseQuery({ isRateQuery });
  const aggregationDescription = `${getAggLabel(aggregation)}${isRateQuery ? ' per-second rate' : ''}`;
  const description = `${VAR_METRIC_EXPR} (${aggregationDescription})`;

  // Create query expressions
  const mainQueryExpr = `${aggregation}(${baseQuery})`;
  const breakdownQueryExpr = `${aggregation}(${baseQuery})by(${VAR_GROUP_BY_EXP})`;

  return generateCommonAutoQueryInfo({
    description,
    mainQueryExpr,
    breakdownQueryExpr,
    unit,
  });
}

// Helpers

function createContext(metricParts: string[], overrides: Partial<AutoQueryContext> = {}): AutoQueryContext {
  return {
    metricParts,
    isRateQuery: false,
    isUtf8Metric: false,
    baseQuery: generateBaseQuery({ isRateQuery: overrides.isRateQuery ?? false }),
    ...overrides,
  };
}

function getAggLabel(agg: string): string {
  return aggLabels[agg] || agg;
}

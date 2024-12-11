import { VAR_METRIC_EXPR, VAR_FILTERS_WITH_CURLY_EXPR, VAR_OTEL_JOIN_QUERY_EXPR, VAR_GROUP_BY_EXP } from '../shared';

import { generateCommonAutoQueryInfo } from './queryGenerators/common';
import { createHistogramMetricQueryDefs } from './queryGenerators/histogram';
import { createSummaryMetricQueryDefs } from './queryGenerators/summary';
import { AutoQueryContext, AutoQueryInfo } from './types';
import { getPerSecondRateUnit, getUnit } from './units';

export const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_WITH_CURLY_EXPR}`;
export const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(isRateQuery: boolean) {
  return isRateQuery
    ? `${GENERAL_RATE_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`
    : `${GENERAL_BASE_QUERY} ${VAR_OTEL_JOIN_QUERY_EXPR}`;
}

export function getAutoQueriesForMetric(metric: string): AutoQueryInfo {
  const metricParts = metric.split('_');
  const suffix = metricParts.at(-1);

  const ctx: AutoQueryContext = {
    metricParts,
    isRateQuery: false,
    isUtf8Metric: false,
    baseQuery: '',
  };

  if (suffix === 'sum') {
    ctx.isRateQuery = true;
    ctx.baseQuery = getGeneralBaseQuery(ctx.isRateQuery);
    return createSummaryMetricQueryDefs(ctx);
  }

  if (suffix === 'bucket') {
    return createHistogramMetricQueryDefs(ctx);
  }

  // If the suffix is null or is in the set of unsupported suffixes, throw an error because the metric should be delegated to a different generator (summary or histogram)
  if (suffix == null || UNSUPPORTED_SUFFIXES.has(suffix)) {
    throw new Error(`This function does not support a metric suffix of "${suffix}"`);
  }

  // Check if generating rate query and/or aggregation query
  const isRateQuery = RATE_SUFFIXES.has(suffix);
  const isAggQuery = SPECIFIC_AGGREGATIONS_FOR_SUFFIX[suffix] || 'avg';

  // Try to find the unit in the Prometheus metric name
  const unitSuffix = suffix === 'total' ? metricParts.at(-2) : suffix;

  // Get the Grafana unit or Grafana rate unit
  const unit = isRateQuery ? getPerSecondRateUnit(unitSuffix) : getUnit(unitSuffix);

  const baseQuery = getGeneralBaseQuery(isRateQuery);
  const aggregationDescription = isRateQuery
    ? `${getAggLabel(isAggQuery)} per-second rate`
    : `${getAggLabel(isAggQuery)}`;

  const description = `${VAR_METRIC_EXPR} (${aggregationDescription})`;

  const mainQueryExpr = `${isAggQuery}(${baseQuery})`;
  const breakdownQueryExpr = `${isAggQuery}(${baseQuery})by(${VAR_GROUP_BY_EXP})`;

  return generateCommonAutoQueryInfo({
    description,
    mainQueryExpr,
    breakdownQueryExpr,
    unit,
  });
}

const RATE_SUFFIXES = new Set(['count', 'total']);
const UNSUPPORTED_SUFFIXES = new Set(['sum', 'bucket']);

/** Non-default aggregation keyed by suffix */
const SPECIFIC_AGGREGATIONS_FOR_SUFFIX: Record<string, string> = {
  count: 'sum',
  total: 'sum',
};

const aggLabels: Record<string, string> = {
  avg: 'average',
  sum: 'overall',
};

function getAggLabel(agg: string) {
  return aggLabels[agg] || agg;
}

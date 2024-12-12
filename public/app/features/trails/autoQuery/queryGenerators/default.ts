import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';
import { AutoQueryContext, AutoQueryInfo } from '../types';
import { getPerSecondRateUnit, getUnit } from '../units';

import { generateBaseQuery } from './baseQuery';
import { generateCommonAutoQueryInfo } from './common';

const RATE_SUFFIXES = new Set(['count', 'total']);
const SPECIFIC_AGGREGATIONS_FOR_SUFFIX: Record<string, string> = {
  count: 'sum',
  total: 'sum',
};
const aggLabels: Record<string, string> = {
  avg: 'average',
  sum: 'overall',
};

function getAggLabel(agg: string): string {
  return aggLabels[agg] || agg;
}

export function createDefaultMetricQueryDefs(context: AutoQueryContext): AutoQueryInfo {
  const { metricParts, suffix, isUtf8Metric } = context;
  const unitSuffix = suffix === 'total' ? metricParts.at(-2) : suffix;

  // Determine query type and unit
  const isRateQuery = RATE_SUFFIXES.has(suffix);
  const aggregation = SPECIFIC_AGGREGATIONS_FOR_SUFFIX[suffix] || 'avg';
  const unit = isRateQuery ? getPerSecondRateUnit(unitSuffix) : getUnit(unitSuffix);

  // Generate base query and descriptions
  const baseQuery = generateBaseQuery({ isRateQuery, isUtf8Metric });
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

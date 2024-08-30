import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from 'app/features/trails/shared';

import { AutoQueryInfo } from '../types';
import { getPerSecondRateUnit, getUnit } from '../units';

import { getGeneralBaseQuery } from './common/baseQuery';
import { generateCommonAutoQueryInfo } from './common/generator';

/** These suffixes will set rate to true */
const RATE_SUFFIXES = new Set(['count', 'total']);

const UNSUPPORTED_SUFFIXES = new Set(['sum', 'bucket']);

/** Non-default aggregation keyed by suffix */
const SPECIFIC_AGGREGATIONS_FOR_SUFFIX: Record<string, string> = {
  count: 'sum',
  total: 'sum',
};

function shouldCheckPreviousSuffixForUnit(suffix: string) {
  return suffix === 'total';
}

const aggLabels: Record<string, string> = {
  avg: 'average',
  sum: 'overall',
};

function getAggLabel(agg: string) {
  return aggLabels[agg] || agg;
}

export type AutoQueryParameters = {
  agg: string;
  unit: string;
  rate: boolean;
};

export function generateQueries({ agg, rate, unit }: AutoQueryParameters): AutoQueryInfo {
  const baseQuery = getGeneralBaseQuery(rate);

  const aggregationDescription = rate ? `${getAggLabel(agg)} per-second rate` : `${getAggLabel(agg)}`;

  const description = `${VAR_METRIC_EXPR} (${aggregationDescription})`;

  const mainQueryExpr = `${agg}(${baseQuery})`;
  const breakdownQueryExpr = `${agg}(${baseQuery})by(${VAR_GROUP_BY_EXP})`;

  return generateCommonAutoQueryInfo({
    description,
    mainQueryExpr,
    breakdownQueryExpr,
    unit,
  });
}

export function createDefaultMetricQueryDefs(metricParts: string[]) {
  // Get the last part of the metric name
  const suffix = metricParts.at(-1);

  // If the suffix is null or is in the set of unsupported suffixes, throw an error because the metric should be delegated to a different generator (summary or histogram)
  if (suffix == null || UNSUPPORTED_SUFFIXES.has(suffix)) {
    throw new Error(`This function does not support a metric suffix of "${suffix}"`);
  }

  // Check if generating rate query and/or aggregation query
  const rate = RATE_SUFFIXES.has(suffix);
  const agg = SPECIFIC_AGGREGATIONS_FOR_SUFFIX[suffix] || 'avg';

  // Try to find the unit in the Prometheus metric name
  const unitSuffix = shouldCheckPreviousSuffixForUnit(suffix) ? metricParts.at(-2) : suffix;

  // Get the Grafana unit or Grafana rate unit
  const unit = rate ? getPerSecondRateUnit(unitSuffix) : getUnit(unitSuffix);

  const params = {
    agg,
    unit,
    rate,
  };
  return generateQueries(params);
}

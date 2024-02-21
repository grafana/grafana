import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../../shared';
import { AutoQueryInfo } from '../../types';
import { generateCommonAutoQueryInfo } from '../common/generator';

import { AutoQueryParameters } from './types';

const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}`;
const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(rate: boolean) {
  return rate ? GENERAL_RATE_BASE_QUERY : GENERAL_BASE_QUERY;
}

const aggLabels: Record<string, string> = {
  avg: 'average',
  sum: 'overall',
};

function getAggLabel(agg: string) {
  return aggLabels[agg] || agg;
}

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

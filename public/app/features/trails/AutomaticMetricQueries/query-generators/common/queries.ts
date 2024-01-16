import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../../shared';
import { simpleGraphBuilder } from '../../graph-builders/simple';
import { AutoQueryInfo } from '../../types';

import { AutoQueryParameters } from './types';

const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}`;
const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(rate: boolean) {
  return rate ? GENERAL_RATE_BASE_QUERY : GENERAL_BASE_QUERY;
}

export function generateQueries({ agg, rate, unit }: AutoQueryParameters): AutoQueryInfo {
  const baseQuery = getGeneralBaseQuery(rate);

  const common = {
    title: `${VAR_METRIC_EXPR}`,
    unit,
    variant: 'graph',
  };

  const main = {
    ...common,
    queries: [{ refId: 'A', expr: `${agg}(${baseQuery})` }],
    vizBuilder: () => simpleGraphBuilder(main),
  };

  const breakdown = {
    ...common,
    queries: [
      {
        refId: 'A',
        expr: `${agg}(${baseQuery}) by(${VAR_GROUP_BY_EXP})`,
        legendFormat: `{{${VAR_GROUP_BY_EXP}}}`,
      },
    ],
    vizBuilder: () => simpleGraphBuilder(breakdown),
  };

  return { preview: main, main: main, breakdown: breakdown, variants: [] };
}

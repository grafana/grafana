import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../../shared';
import { simpleGraphBuilder } from '../../graph-builders/simple';
import { AutoQueryDef, AutoQueryInfo } from '../../types';

import { AutoQueryParameters } from './types';

const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}`;
const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(rate: boolean) {
  return rate ? GENERAL_RATE_BASE_QUERY : GENERAL_BASE_QUERY;
}

export function generateQueries({ agg, rate, unit }: AutoQueryParameters): AutoQueryInfo {
  const baseQuery = getGeneralBaseQuery(rate);

  const main = createMainQuery(baseQuery, agg, unit);

  const breakdown = createBreakdownQuery(baseQuery, agg, unit);

  return { preview: main, main: main, breakdown: breakdown, variants: [] };
}

function createMainQuery(baseQuery: string, agg: string, unit: string): AutoQueryDef {
  return {
    title: `${VAR_METRIC_EXPR}`,
    variant: 'graph',
    unit,
    queries: [{ refId: 'A', expr: `${agg}(${baseQuery})` }],
    vizBuilder: simpleGraphBuilder,
  };
}

function createBreakdownQuery(baseQuery: string, agg: string, unit: string): AutoQueryDef {
  return {
    title: `${VAR_METRIC_EXPR}`,
    variant: 'graph',
    unit,
    queries: [
      {
        refId: 'A',
        expr: `${agg}(${baseQuery}) by(${VAR_GROUP_BY_EXP})`,
        legendFormat: `{{${VAR_GROUP_BY_EXP}}}`,
      },
    ],
    vizBuilder: simpleGraphBuilder,
  };
}

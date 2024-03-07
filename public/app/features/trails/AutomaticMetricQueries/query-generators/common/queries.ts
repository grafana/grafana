import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../../shared';
import { simpleGraphBuilder } from '../../graph-builders/simple';
import { AutoQueryInfo } from '../../types';

import { AutoQueryParameters } from './types';

const GENERAL_BASE_QUERY = `${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}`;
const GENERAL_RATE_BASE_QUERY = `rate(${GENERAL_BASE_QUERY}[$__rate_interval])`;

export function getGeneralBaseQuery(rate: boolean) {
  return rate ? GENERAL_RATE_BASE_QUERY : GENERAL_BASE_QUERY;
}

const aggLabels: Record<string, string> = {
  avg: 'average',
  sum: 'sum',
};

function getAggLabel(agg: string) {
  return aggLabels[agg] || agg;
}

export function generateQueries({ agg, rate, unit }: AutoQueryParameters): AutoQueryInfo {
  const baseQuery = getGeneralBaseQuery(rate);

  const description = rate ? `${getAggLabel(agg)} of rates per second` : `${getAggLabel(agg)}`;

  const common = {
    title: `${VAR_METRIC_EXPR}`,
    unit,
    variant: description,
  };

  const mainQuery = {
    refId: 'A',
    expr: `${agg}(${baseQuery})`,
    legendFormat: `${VAR_METRIC_EXPR} (${description})`,
  };

  const main = {
    ...common,
    title: `${VAR_METRIC_EXPR} (${description})`,
    queries: [mainQuery],
    vizBuilder: () => simpleGraphBuilder({ ...main }),
  };

  const preview = {
    ...main,
    title: `${VAR_METRIC_EXPR}`,
    queries: [{ ...mainQuery, legendFormat: description }],
    vizBuilder: () => simpleGraphBuilder(preview),
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

  return { preview, main, breakdown, variants: [] };
}

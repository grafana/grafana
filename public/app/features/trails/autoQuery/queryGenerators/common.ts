import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';
import { simpleGraphBuilder } from '../graphBuilders';
import { AutoQueryInfo } from '../types';

export type CommonQueryInfoParams = {
  description: string;
  mainQueryExpr: string;
  breakdownQueryExpr: string;
  unit: string;
};

export function generateCommonAutoQueryInfo({
  description,
  mainQueryExpr,
  breakdownQueryExpr,
  unit,
}: CommonQueryInfoParams): AutoQueryInfo {
  const common = {
    title: VAR_METRIC_EXPR,
    unit,
  };

  const mainQuery = {
    refId: 'A',
    expr: mainQueryExpr,
    legendFormat: description,
    fromExploreMetrics: true,
  };

  const main = {
    ...common,
    title: description,
    queries: [mainQuery],
    variant: 'main',
    vizBuilder: () => simpleGraphBuilder({ ...main }),
  };

  const preview = {
    ...common,
    queries: [{ ...mainQuery, legendFormat: description }],
    vizBuilder: () => simpleGraphBuilder(preview),
    variant: 'preview',
  };

  const breakdown = {
    ...common,
    queries: [
      {
        refId: 'A',
        expr: breakdownQueryExpr,
        legendFormat: `{{${VAR_GROUP_BY_EXP}}}`,
        fromExploreMetrics: true,
      },
    ],
    vizBuilder: () => simpleGraphBuilder(breakdown),
    variant: 'breakdown',
  };

  return { preview, main, breakdown, variants: [] };
}

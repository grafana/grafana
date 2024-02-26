import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';
import { AutoQueryInfo } from '../types';
import { getUnit } from '../units';

import { generateCommonAutoQueryInfo } from './common/generator';
import { getGeneralBaseQuery } from './common/queries';

export function createSummaryQueryDefs(metricParts: string[]): AutoQueryInfo {
  const suffix = metricParts.at(-1);
  if (suffix !== 'sum') {
    throw new Error('createSummaryQueryDefs is only to be used for metrics that end in "_sum"');
  }

  const unitSuffix = metricParts.at(-2);
  const unit = getUnit(unitSuffix);

  const rate = true;
  const baseQuery = getGeneralBaseQuery(rate);

  const subMetric = metricParts.slice(0, -1).join('_');
  const mainQueryExpr = createMeanExpr(`sum(${baseQuery})`);
  const breakdownQueryExpr = createMeanExpr(`sum(${baseQuery})by(${VAR_GROUP_BY_EXP})`);

  const operationDescription = `average`;
  const description = `${subMetric} (${operationDescription})`;

  function createMeanExpr(expr: string) {
    const numerator = expr.replace(VAR_METRIC_EXPR, `${subMetric}_sum`);
    const denominator = expr.replace(VAR_METRIC_EXPR, `${subMetric}_count`);
    return `${numerator}/${denominator}`;
  }

  return generateCommonAutoQueryInfo({
    description,
    mainQueryExpr,
    breakdownQueryExpr,
    unit,
  });
}

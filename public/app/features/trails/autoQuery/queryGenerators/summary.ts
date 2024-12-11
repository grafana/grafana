import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';
import { AutoQueryInfo } from '../types';
import { getUnit } from '../units';

import { getGeneralBaseQuery } from './baseQuery';
import { generateCommonAutoQueryInfo } from './common';

export function createSummaryMetricQueryDefs(metricParts: string[]): AutoQueryInfo {
  const suffix = metricParts.at(-1);
  if (suffix !== 'sum') {
    throw new Error('createSummaryMetricQueryDefs is only to be used for metrics that end in "_sum"');
  }

  const unitSuffix = metricParts.at(-2);
  const unit = getUnit(unitSuffix);
  const baseQuery = getGeneralBaseQuery(true);
  const subMetric = metricParts.slice(0, -1).join('_');

  const description = `${subMetric} (average)`;
  const mainQueryExpr = createMeanExpr(`sum(${baseQuery})`, subMetric);
  const breakdownQueryExpr = createMeanExpr(`sum(${baseQuery})by(${VAR_GROUP_BY_EXP})`, subMetric);

  return generateCommonAutoQueryInfo({
    description,
    mainQueryExpr,
    breakdownQueryExpr,
    unit,
  });
}

function createMeanExpr(expr: string, subMetric: string): string {
  const numerator = expr.replace(VAR_METRIC_EXPR, `${subMetric}_sum`);
  const denominator = expr.replace(VAR_METRIC_EXPR, `${subMetric}_count`);
  return `${numerator}/${denominator}`;
}

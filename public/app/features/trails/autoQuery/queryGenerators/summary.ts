import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';
import { AutoQueryContext, AutoQueryInfo } from '../types';
import { getUnit } from '../units';

import { generateBaseQuery } from './baseQuery';
import { generateCommonAutoQueryInfo } from './common';

export function createSummaryMetricQueryDefs(context: AutoQueryContext): AutoQueryInfo {
  const { metricParts, isUtf8Metric } = context;
  const suffix = metricParts.at(-1);
  if (suffix !== 'sum') {
    throw new Error('createSummaryMetricQueryDefs is only to be used for metrics that end in "_sum"');
  }

  const unitSuffix = metricParts.at(-2);
  const unit = getUnit(unitSuffix);
  const subMetric = metricParts.slice(0, -1).join('_');

  const description = `${subMetric} (average)`;
  const baseQuery = generateBaseQuery({ isRateQuery: true, isUtf8Metric });
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

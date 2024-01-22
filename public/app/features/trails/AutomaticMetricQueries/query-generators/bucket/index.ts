import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../../shared';
import { heatmapGraphBuilder } from '../../graph-builders/heatmap';
import { percentilesGraphBuilder } from '../../graph-builders/percentiles';
import { simpleGraphBuilder } from '../../graph-builders/simple';
import { AutoQueryDef } from '../../types';
import { getUnit } from '../../units';

function generator(metricParts: string[]) {
  const title = `${VAR_METRIC_EXPR}`;

  const unitSuffix = metricParts.at(-2);

  const unit = getUnit(unitSuffix);

  const common = {
    title,
    unit,
  };

  const p50: AutoQueryDef = {
    ...common,
    variant: 'p50',
    queries: [percentileQuery(50)],
    vizBuilder: () => simpleGraphBuilder(p50),
  };

  const breakdown: AutoQueryDef = {
    ...common,
    variant: 'p50',
    queries: [percentileQuery(50, [VAR_GROUP_BY_EXP])],
    vizBuilder: () => simpleGraphBuilder(breakdown),
  };

  const percentiles: AutoQueryDef = {
    ...common,
    variant: 'percentiles',
    queries: [99, 90, 50].map((p) => percentileQuery(p)).map(fixRefIds),
    vizBuilder: () => percentilesGraphBuilder(percentiles),
  };

  const heatmap: AutoQueryDef = {
    ...common,
    variant: 'heatmap',
    queries: [heatMapQuery()],
    vizBuilder: () => heatmapGraphBuilder(heatmap),
  };

  return { preview: p50, main: percentiles, variants: [percentiles, heatmap], breakdown: breakdown };
}

function fixRefIds(queryDef: PromQuery, index: number): PromQuery {
  // By default refIds are `"A"`
  // This method will reassign based on `A + index` -- A, B, C, etc
  return {
    ...queryDef,
    refId: String.fromCharCode('A'.charCodeAt(0) + index),
  };
}

export default { generator };

const BASE_QUERY = `rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])`;

function baseQuery(groupings: string[] = []) {
  const sumByList = ['le', ...groupings];
  return `sum by(${sumByList.join(', ')}) (${BASE_QUERY})`;
}

function heatMapQuery(groupings: string[] = []): PromQuery {
  return {
    refId: 'A',
    expr: baseQuery(groupings),
    format: 'heatmap',
  };
}

function percentileQuery(percentile: number, groupings: string[] = []) {
  const percent = percentile / 100;

  return {
    refId: 'A',
    expr: `histogram_quantile(${percent}, ${baseQuery(groupings)})`,
    legendFormat: `${percentile}th Percentile`,
  };
}

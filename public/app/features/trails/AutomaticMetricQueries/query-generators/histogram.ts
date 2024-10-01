import { PromQuery } from '@grafana/prometheus';

import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR, VAR_OTEL_JOIN_QUERY_EXPR } from '../../shared';
import { heatmapGraphBuilder } from '../graph-builders/heatmap';
import { percentilesGraphBuilder } from '../graph-builders/percentiles';
import { simpleGraphBuilder } from '../graph-builders/simple';
import { AutoQueryDef } from '../types';
import { getUnit } from '../units';

export function createHistogramMetricQueryDefs(metricParts: string[]) {
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
    queries: [99, 90, 50].map((p) => percentileQuery(p)),
    vizBuilder: () => percentilesGraphBuilder(percentiles),
  };

  const heatmap: AutoQueryDef = {
    ...common,
    variant: 'heatmap',
    queries: [heatMapQuery()],
    vizBuilder: () => heatmapGraphBuilder(heatmap),
  };

  return { preview: heatmap, main: heatmap, variants: [percentiles, heatmap], breakdown: breakdown };
}

const BASE_QUERY = `rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])${VAR_OTEL_JOIN_QUERY_EXPR}`;

function baseQuery(groupings: string[] = []) {
  const sumByList = ['le', ...groupings];
  return `sum by(${sumByList.join(', ')}) (${BASE_QUERY})`;
}

function heatMapQuery(groupings: string[] = []): PromQuery {
  return {
    refId: 'Heatmap',
    expr: baseQuery(groupings),
    format: 'heatmap',
  };
}

function percentileQuery(percentile: number, groupings: string[] = []) {
  const percent = percentile / 100;

  let legendFormat = `${percentile}th Percentile`;

  // For the breakdown view, show the label value variable we are grouping by
  if (groupings[0]) {
    legendFormat = `{{${groupings[0]}}}`;
  }

  return {
    refId: `Percentile${percentile}`,
    expr: `histogram_quantile(${percent}, ${baseQuery(groupings)})`,
    legendFormat,
  };
}

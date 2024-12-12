import { VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../shared';
import { heatmapGraphBuilder, percentilesGraphBuilder, simpleGraphBuilder } from '../graphBuilders';
import { AutoQueryContext, AutoQueryDef } from '../types';

import { generateBaseQuery } from './baseQuery';

export function createHistogramMetricQueryDefs(context: AutoQueryContext) {
  const { unit } = context;

  const common = {
    title: VAR_METRIC_EXPR,
    unit,
  };

  const p50: AutoQueryDef = {
    ...common,
    variant: 'p50',
    queries: [percentileQuery(context, 50)],
    vizBuilder: () => simpleGraphBuilder(p50),
  };

  const breakdown: AutoQueryDef = {
    ...common,
    variant: 'p50',
    queries: [percentileQuery(context, 50, [VAR_GROUP_BY_EXP])],
    vizBuilder: () => simpleGraphBuilder(breakdown),
  };

  const percentiles: AutoQueryDef = {
    ...common,
    variant: 'percentiles',
    queries: [99, 90, 50].map((p) => percentileQuery(context, p)),
    vizBuilder: () => percentilesGraphBuilder(percentiles),
  };

  const heatmap: AutoQueryDef = {
    ...common,
    variant: 'heatmap',
    queries: [
      {
        refId: 'Heatmap',
        expr: generateBaseQuery({
          isRateQuery: true,
          isUtf8Metric: context.isUtf8Metric,
          groupings: ['le'],
        }),
        format: 'heatmap',
      },
    ],
    vizBuilder: () => heatmapGraphBuilder(heatmap),
  };

  return { preview: heatmap, main: heatmap, variants: [percentiles, heatmap], breakdown: breakdown };
}

function percentileQuery(context: AutoQueryContext, percentile: number, groupings: string[] = []) {
  const percent = percentile / 100;

  let legendFormat = `${percentile}th Percentile`;

  // For the breakdown view, show the label value variable we are grouping by
  if (groupings[0]) {
    legendFormat = `{{${groupings[0]}}}`;
  }

  const query = generateBaseQuery({
    isRateQuery: true,
    isUtf8Metric: context.isUtf8Metric,
    groupings: ['le', ...groupings],
  });

  return {
    refId: `Percentile${percentile}`,
    expr: `histogram_quantile(${percent}, ${query})`,
    legendFormat,
  };
}

import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../../../shared';
import { heatmapGraphBuilder } from '../../graph-builders/heatmap';
import { percentilesGraphBuilder } from '../../graph-builders/percentiles';
import { simpleGraphBuilder } from '../../graph-builders/simple';
import { AutoQueryDef } from '../../types';

function generator(metricParts: string[]) {
  let unit = 'short';

  const title = `${VAR_METRIC_EXPR}`;

  const unitSuffix = metricParts.at(-2);

  if (unitSuffix === 'seconds') {
    // TODO Map to other units
    unit = 's';
  }

  const p50: AutoQueryDef = {
    title,
    variant: 'p50',
    unit,
    queries: [
      {
        refId: 'A',
        expr: `histogram_quantile(0.50, sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
      },
    ],
    vizBuilder: simpleGraphBuilder,
  };

  const breakdown: AutoQueryDef = {
    title,
    variant: 'p50',
    unit,
    queries: [
      {
        refId: 'A',
        expr: `histogram_quantile(0.50, sum by(le, ${VAR_GROUP_BY_EXP}) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
      },
    ],
    vizBuilder: simpleGraphBuilder,
  };

  const percentiles: AutoQueryDef = {
    title,
    variant: 'percentiles',
    unit,
    queries: [
      {
        refId: 'A',
        expr: `histogram_quantile(0.99, sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
        legendFormat: '99th Percentile',
      },
      {
        refId: 'B',
        expr: `histogram_quantile(0.90, sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
        legendFormat: '90th Percentile',
      },
      {
        refId: 'C',
        expr: `histogram_quantile(0.50, sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
        legendFormat: '50th Percentile',
      },
    ],
    vizBuilder: percentilesGraphBuilder,
  };

  const heatmap: AutoQueryDef = {
    title,
    variant: 'heatmap',
    unit,
    queries: [
      {
        refId: 'A',
        expr: `sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval]))`,
        format: 'heatmap',
      },
    ],
    vizBuilder: heatmapGraphBuilder,
  };

  return { preview: p50, main: percentiles, variants: [percentiles, heatmap], breakdown: breakdown };
}

export default { generator };

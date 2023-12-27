import { PanelBuilders, VizPanelBuilder } from '@grafana/scenes';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { HeatmapColorMode } from 'app/plugins/panel/heatmap/types';

import { VAR_FILTERS_EXPR, VAR_GROUP_BY_EXP, VAR_METRIC_EXPR } from '../shared';

export interface AutoQueryDef {
  variant: string;
  title: string;
  unit: string;
  queries: PromQuery[];
  vizBuilder: (def: AutoQueryDef) => VizPanelBuilder<{}, {}>;
}

export interface AutoQueryInfo {
  preview: AutoQueryDef;
  main: AutoQueryDef;
  variants: AutoQueryDef[];
  breakdown: AutoQueryDef;
}

export function getAutoQueriesForMetric(metric: string): AutoQueryInfo {
  let unit = 'short';
  let agg = 'avg';
  let rate = false;
  let title = metric;

  if (metric.endsWith('seconds_sum')) {
    unit = 's';
    agg = 'avg';
    rate = true;
  } else if (metric.endsWith('seconds')) {
    unit = 's';
    agg = 'avg';
    rate = false;
  } else if (metric.endsWith('bytes')) {
    unit = 'bytes';
    agg = 'avg';
    rate = false;
  } else if (metric.endsWith('seconds_count') || metric.endsWith('seconds_total')) {
    agg = 'sum';
    rate = true;
  } else if (metric.endsWith('bucket')) {
    return getQueriesForBucketMetric(metric);
  } else if (metric.endsWith('count') || metric.endsWith('total')) {
    agg = 'sum';
    rate = true;
  }

  let query = `${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}`;
  if (rate) {
    query = `rate(${query}[$__rate_interval])`;
  }

  const main: AutoQueryDef = {
    title: `${title}`,
    variant: 'graph',
    unit,
    queries: [{ refId: 'A', expr: `${agg}(${query})` }],
    vizBuilder: simpleGraphBuilder,
  };

  const breakdown: AutoQueryDef = {
    title: `${title}`,
    variant: 'graph',
    unit,
    queries: [
      {
        refId: 'A',
        expr: `${agg}(${query}) by(${VAR_GROUP_BY_EXP})`,
        legendFormat: `{{${VAR_GROUP_BY_EXP}}}`,
      },
    ],
    vizBuilder: simpleGraphBuilder,
  };

  return { preview: main, main: main, breakdown: breakdown, variants: [] };
}

function getQueriesForBucketMetric(metric: string): AutoQueryInfo {
  let unit = 'short';

  if (metric.endsWith('seconds_bucket')) {
    unit = 's';
  }

  const p50: AutoQueryDef = {
    title: metric,
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
    title: metric,
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
    title: metric,
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
    title: metric,
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

function simpleGraphBuilder(def: AutoQueryDef) {
  return PanelBuilders.timeseries()
    .setTitle(def.title)
    .setUnit(def.unit)
    .setOption('legend', { showLegend: false })
    .setCustomFieldConfig('fillOpacity', 9);
}

function percentilesGraphBuilder(def: AutoQueryDef) {
  return PanelBuilders.timeseries().setTitle(def.title).setUnit(def.unit).setCustomFieldConfig('fillOpacity', 9);
}

function heatmapGraphBuilder(def: AutoQueryDef) {
  return PanelBuilders.heatmap()
    .setTitle(def.title)
    .setUnit(def.unit)
    .setOption('calculate', false)
    .setOption('color', {
      mode: HeatmapColorMode.Scheme,
      exponent: 0.5,
      scheme: 'Spectral',
      steps: 32,
      reverse: false,
    });
}

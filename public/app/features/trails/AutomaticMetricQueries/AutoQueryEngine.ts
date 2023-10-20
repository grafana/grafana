import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR } from '../shared';

export interface AutoQueryDef {
  variant: AutoQueryVariant;
  title: string;
  unit: string;
  query: PromQuery;
}

export type AutoQueryVariant = 'graph' | 'heatmap' | 'p95';

export function getAutoQueriesForMetric(metric: string) {
  const queries: AutoQueryDef[] = [];

  let unit = 'short';
  let agg = 'sum';
  //let rate = false;
  let title = metric;

  if (metric.endsWith('seconds_sum')) {
    unit = 's';
    agg = 'avg';
  } else if (metric.endsWith('seconds')) {
    unit = 's';
    agg = 'avg';
  } else if (metric.endsWith('seconds_count')) {
    unit = 's';
    agg = 'avg';
  } else if (metric.endsWith('bucket')) {
    return getQueriesForBucketMetric(metric);
  }

  queries.push({
    title: `${title}`,
    variant: 'graph',
    unit,
    query: {
      refId: 'A',
      expr: `${agg}(rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval]))`,
    },
  });

  return queries;
}

function getQueriesForBucketMetric(metric: string) {
  const queries: AutoQueryDef[] = [];
  let unit = 'short';

  if (metric.endsWith('seconds_bucket')) {
    unit = 's';
  }

  queries.push({
    title: metric,
    variant: 'p95',
    unit,
    query: {
      refId: 'A',
      expr: `histogram_quantile(0.95, sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
    },
  });

  queries.push({
    title: metric,
    variant: 'heatmap',
    unit,
    query: {
      refId: 'A',
      expr: `sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval]))`,
      format: 'heatmap',
    },
  });

  return queries;
}

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

  queries.push({
    title: `${title}`,
    variant: 'graph',
    unit,
    query: {
      refId: 'A',
      expr: `${agg}(${query})`,
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

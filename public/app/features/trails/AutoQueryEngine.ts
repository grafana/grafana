import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR } from './shared';

export interface AutoQueryResult {
  variantName?: string;
  title: string;
  visualization: string;
  unit: string;
  query: PromQuery;
}

export function getAutoQueriesForMetric(metric: string) {
  const queries: AutoQueryResult[] = [];

  let unit = 'short';
  let agg = 'sum';
  let rateInterval = false;
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
    rateInterval = true;
  } else if (metric.endsWith('bucket')) {
    return getQueriesForBucketMetric(metric);
  }

  queries.push({
    title: `${title}`,
    visualization: 'timeseries',
    unit,
    query: {
      refId: 'A',
      expr: `${agg}(rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval]))`,
    },
  });

  return queries;
}

function getQueriesForBucketMetric(metric: string) {
  const queries: AutoQueryResult[] = [];
  let unit = 'short';

  if (metric.endsWith('seconds_bucket')) {
    unit = 's';
  }

  const title = `${metric} p95`;

  queries.push({
    title,
    visualization: 'timeseries',
    unit,
    query: {
      refId: 'A',
      expr: `histogram_quantile(0.95, sum by(le) (rate(${VAR_METRIC_EXPR}${VAR_FILTERS_EXPR}[$__rate_interval])))`,
    },
  });

  return queries;
}

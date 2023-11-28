import { ExtendedStats, MetricAggregation } from './dataquery.gen';

export function isMetricAggregationWithMeta(metric: MetricAggregation): metric is ExtendedStats {
  if (!metric || typeof metric !== 'object') {
    return false;
  }
  return 'meta' in metric;
}

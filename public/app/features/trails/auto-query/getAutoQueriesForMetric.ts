import { createDefaultMetricQueryDefs } from './query-generators/default';
import { createHistogramMetricQueryDefs } from './query-generators/histogram';
import { createSummaryMetricQueryDefs } from './query-generators/summary';
import { AutoQueryInfo } from './types';

export function getAutoQueriesForMetric(metric: string): AutoQueryInfo {
  const metricParts = metric.split('_');
  const suffix = metricParts.at(-1);

  if (suffix === 'sum') {
    return createSummaryMetricQueryDefs(metricParts);
  }

  if (suffix === 'bucket') {
    return createHistogramMetricQueryDefs(metricParts);
  }

  return createDefaultMetricQueryDefs(metricParts);
}

import { createDefaultMetricQueryDefs } from './queryGenerators/default';
import { createHistogramMetricQueryDefs } from './queryGenerators/histogram';
import { createSummaryMetricQueryDefs } from './queryGenerators/summary';
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

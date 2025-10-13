import { isValidLegacyName } from '@grafana/prometheus';

import { createDefaultMetricQueryDefs } from './queryGenerators/default';
import { createHistogramMetricQueryDefs } from './queryGenerators/histogram';
import { createSummaryMetricQueryDefs } from './queryGenerators/summary';
import { AutoQueryContext, AutoQueryInfo } from './types';
import { getUnit } from './units';

export function getAutoQueriesForMetric(metric: string, nativeHistogram?: boolean): AutoQueryInfo {
  const isUtf8Metric = !isValidLegacyName(metric);
  const metricParts = metric.split('_');
  const suffix = metricParts.at(-1);

  // If the suffix is null or is in the set of unsupported suffixes, throw an error because the metric should be delegated to a different generator (summary or histogram)
  if (suffix == null) {
    throw new Error(`This function does not support a metric suffix of "${suffix}"`);
  }

  const unitSuffix = metricParts.at(-2);
  const unit = getUnit(unitSuffix);
  const ctx: AutoQueryContext = {
    metricParts,
    isUtf8Metric,
    suffix,
    unitSuffix,
    unit,
  };

  if (suffix === 'sum') {
    return createSummaryMetricQueryDefs(ctx);
  }

  if (suffix === 'bucket' || nativeHistogram) {
    return createHistogramMetricQueryDefs(ctx);
  }

  return createDefaultMetricQueryDefs(ctx);
}

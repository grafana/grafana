import { generateBaseQuery } from './queryGenerators/baseQuery';
import { createDefaultMetricQueryDefs } from './queryGenerators/default';
import { createHistogramMetricQueryDefs } from './queryGenerators/histogram';
import { createSummaryMetricQueryDefs } from './queryGenerators/summary';
import { AutoQueryContext, AutoQueryInfo } from './types';

const UNSUPPORTED_SUFFIXES = new Set(['sum', 'bucket']);

export function getAutoQueriesForMetric(metric: string): AutoQueryInfo {
  const metricParts = metric.split('_');
  const suffix = metricParts.at(-1);

  // Handle special cases: summary and histogram
  if (suffix === 'sum') {
    return createSummaryMetricQueryDefs(createContext(metricParts, { isRateQuery: true }));
  }
  if (suffix === 'bucket') {
    return createHistogramMetricQueryDefs(createContext(metricParts));
  }

  // If the suffix is null or is in the set of unsupported suffixes, throw an error because the metric should be delegated to a different generator (summary or histogram)
  if (suffix == null || UNSUPPORTED_SUFFIXES.has(suffix)) {
    throw new Error(`This function does not support a metric suffix of "${suffix}"`);
  }

  return createDefaultMetricQueryDefs(metricParts, suffix);
}


function createContext(metricParts: string[], overrides: Partial<AutoQueryContext> = {}): AutoQueryContext {
  return {
    metricParts,
    isRateQuery: false,
    isUtf8Metric: false,
    baseQuery: generateBaseQuery({ isRateQuery: overrides.isRateQuery ?? false }),
    ...overrides,
  };
}

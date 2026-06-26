import { AutoQueryInfo } from '../types';

import { createDefaultMetricQueryDefs } from './default';
import { createHistogramMetricQueryDefs } from './histogram';
import { createSummaryMetricQueryDefs } from './summary';

// TODO: when we have a known unit parameter, use that rather than having the generator functions infer from suffix
export type MetricQueriesGenerator = (metricParts: string[]) => AutoQueryInfo;

export function getQueryGeneratorFor(suffix?: string): MetricQueriesGenerator {
  if (suffix === 'sum') {
    return createSummaryMetricQueryDefs;
  }

  if (suffix === 'bucket') {
    return createHistogramMetricQueryDefs;
  }

  return createDefaultMetricQueryDefs;
}

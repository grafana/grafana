import general from './common';
import { createHistogramQueryDefs } from './histogram';
import { createSummaryQueryDefs } from './summary';
import { MetricQueriesGenerator } from './types';

const SUFFIX_TO_ALTERNATIVE_GENERATOR: Record<string, MetricQueriesGenerator> = {
  sum: createSummaryQueryDefs,
  bucket: createHistogramQueryDefs,
};

export function getQueryGeneratorFor(suffix?: string) {
  return (suffix && SUFFIX_TO_ALTERNATIVE_GENERATOR[suffix]) || general.generator;
}

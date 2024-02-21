import bucket from './bucket';
import general from './common';
import { MetricQueriesGenerator } from './types';

const SUFFIX_TO_ALTERNATIVE_GENERATOR: Record<string, MetricQueriesGenerator> = {
  bucket: bucket.generator,
};

export function getQueryGeneratorFor(suffix?: string) {
  return (suffix && SUFFIX_TO_ALTERNATIVE_GENERATOR[suffix]) || general.generator;
}

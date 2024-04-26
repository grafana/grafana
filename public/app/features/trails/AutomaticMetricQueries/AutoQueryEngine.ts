import { getQueryGeneratorFor } from './query-generators';
import { AutoQueryInfo } from './types';

export function getAutoQueriesForMetric(metric: string): AutoQueryInfo {
  const metricParts = metric.split('_');

  const suffix = metricParts.at(-1);

  const generator = getQueryGeneratorFor(suffix);

  if (!generator) {
    throw new Error(`Unable to generate queries for metric "${metric}" due to issues with derived suffix "${suffix}"`);
  }

  return generator(metricParts);
}

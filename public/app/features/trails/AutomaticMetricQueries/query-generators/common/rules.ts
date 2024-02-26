import { getUnit, getPerSecondRateUnit } from '../../units';

import { AutoQueryParameters } from './types';

/** These suffixes will set rate to true */
const RATE_SUFFIXES = new Set(['count', 'total']);

const UNSUPPORTED_SUFFIXES = new Set(['sum', 'bucket']);

/** Non-default aggregattion keyed by suffix */
const SPECIFIC_AGGREGATIONS_FOR_SUFFIX: Record<string, string> = {
  count: 'sum',
  total: 'sum',
};

function checkPreviousForUnit(suffix: string) {
  return suffix === 'total';
}

export function getGeneratorParameters(metricParts: string[]): AutoQueryParameters {
  const suffix = metricParts.at(-1);

  if (suffix == null || UNSUPPORTED_SUFFIXES.has(suffix)) {
    throw new Error(`This function does not support a metric suffix of "${suffix}"`);
  }

  const rate = RATE_SUFFIXES.has(suffix);
  const agg = SPECIFIC_AGGREGATIONS_FOR_SUFFIX[suffix] || 'avg';

  const unitSuffix = checkPreviousForUnit(suffix) ? metricParts.at(-2) : suffix;

  const unit = rate ? getPerSecondRateUnit(unitSuffix) : getUnit(unitSuffix);

  return {
    agg,
    unit,
    rate,
  };
}

import { getUnit, getPerSecondRateUnit } from '../../units';

import { AutoQueryParameters } from './types';

/** These suffixes will set rate to true */
const RATE_SUFFIXES = new Set(['count', 'total', 'sum']);

/** Non-default aggregattion keyed by suffix */
const SPECIFIC_AGGREGATIONS_FOR_SUFFIX: Record<string, string> = {
  count: 'sum',
  total: 'sum',
  sum: 'avg',
};

function checkPreviousForUnit(suffix: string) {
  return suffix === 'total' || suffix === 'sum';
}

export function getGeneratorParameters(metricParts: string[]): AutoQueryParameters {
  const suffix = metricParts.at(-1);

  if (suffix == null) {
    throw new Error('Invalid metric parameter');
  }

  const rate = RATE_SUFFIXES.has(suffix);

  const unitSuffix = checkPreviousForUnit(suffix) ? metricParts.at(-2) : suffix;

  const unit = rate ? getPerSecondRateUnit(unitSuffix) : getUnit(unitSuffix);

  const agg = SPECIFIC_AGGREGATIONS_FOR_SUFFIX[suffix] || 'avg';

  return {
    agg,
    unit,
    rate,
  };
}

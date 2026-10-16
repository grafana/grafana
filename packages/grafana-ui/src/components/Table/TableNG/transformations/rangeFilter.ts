import { type MatcherConfig, type RangeValueMatcherOptions } from '@grafana/data';
import { FilterByValueType, type FilterByValueConfig } from '@grafana/data/internal';

interface RangeSelection {
  min?: number;
  max?: number;
  includeMissing: boolean;
}

export function createRangePredicate({ min, max, includeMissing }: RangeSelection): MatcherConfig {
  return {
    id: 'between',
    options: {
      from: min,
      to: max,
      inclusive: true,
      allowOpenBounds: true,
      includeMissing,
    } satisfies RangeValueMatcherOptions<number>,
  };
}

export function editableRangeFilter(config: FilterByValueConfig) {
  const predicate = config.options.filters[0];
  const options = predicate?.config.options;
  return (
    config.options.type === FilterByValueType.include &&
    config.options.filters.length === 1 &&
    predicate?.config.id === 'between' &&
    options?.inclusive === true &&
    options.allowOpenBounds === true &&
    typeof options.includeMissing === 'boolean' &&
    (options.from === undefined || Number.isFinite(options.from)) &&
    (options.to === undefined || Number.isFinite(options.to))
  );
}

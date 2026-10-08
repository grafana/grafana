import { type MatcherConfig, type RangeValueMatcherOptions } from '@grafana/data';
import { FilterByValueType, type FilterByValueConfig } from '@grafana/data/internal';

import { readFieldFilters, writeTableFilter, type RowFilterContext } from './filterByValue';
import { type TableTransformation } from './types';

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

export const rangeFilter = {
  matcherId: 'between',
  read: readFieldFilters,
  write: writeTableFilter,
  createPredicate: createRangePredicate,
  isEditable(config: FilterByValueConfig) {
    const predicate = config.options.filters[0];
    const options = predicate?.config.options;
    // This editor cannot preserve exclusive bounds or legacy value coercion.
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
  },
} satisfies TableTransformation<FilterByValueConfig[], MatcherConfig, RowFilterContext> & {
  matcherId: string;
  createPredicate: typeof createRangePredicate;
  isEditable(config: FilterByValueConfig): boolean;
};

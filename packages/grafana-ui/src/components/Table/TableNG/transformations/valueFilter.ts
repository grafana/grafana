import { type Field, type MatcherConfig } from '@grafana/data';
import { FilterByValueType, type FilterByValueConfig, type ValueSetOptions } from '@grafana/data/internal';

import { readFieldFilters, writeTableFilter, type RowFilterContext } from './filterByValue';
import { type TableTransformation } from './types';

export function createValuePredicate(
  field: Field,
  values: ValueSetOptions['values'],
  selection?: ValueSetOptions
): MatcherConfig {
  return {
    id: 'inSet',
    options: {
      ...selection,
      values,
      mode: 'display',
      displayConfig: selection?.displayConfig ?? {
        unit: field.config.unit,
        decimals: field.config.decimals,
        mappings: field.config.mappings,
        noValue: field.config.noValue,
        min: field.config.min,
        max: field.config.max,
      },
      timeZone: selection?.timeZone,
    } satisfies ValueSetOptions,
  };
}

export const valueFilter = {
  matcherId: 'inSet',
  read: readFieldFilters,
  write: writeTableFilter,
  createPredicate: createValuePredicate,
  isEditable(config: FilterByValueConfig) {
    const predicate = config.options.filters[0];
    return (
      config.options.type === FilterByValueType.include &&
      config.options.filters.length === 1 &&
      predicate.config.id === 'inSet' &&
      predicate.config.options.mode === 'display'
    );
  },
} satisfies TableTransformation<FilterByValueConfig[], MatcherConfig, RowFilterContext> & {
  matcherId: string;
  createPredicate: typeof createValuePredicate;
  isEditable(config: FilterByValueConfig): boolean;
};

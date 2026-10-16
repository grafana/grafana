import { type Field, type MatcherConfig } from '@grafana/data';
import { FilterByValueType, type FilterByValueConfig, type ValueSetOptions } from '@grafana/data/internal';

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
      displayConfig: selection?.displayConfig ?? field.config,
      timeZone: selection?.timeZone,
    } satisfies ValueSetOptions,
  };
}

export function editableValueFilter(config: FilterByValueConfig) {
  const predicate = config.options.filters[0];
  return (
    config.options.type === FilterByValueType.include &&
    config.options.filters.length === 1 &&
    predicate.config.id === 'inSet' &&
    predicate.config.options.mode === 'display'
  );
}

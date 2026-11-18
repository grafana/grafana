import { type Field, type MatcherConfig } from '@grafana/data';
import {
  FilterByValueType,
  isPillCellField,
  type FilterByValueConfig,
  type ValueSetOptions,
} from '@grafana/data/internal';

import { editableRangeFilter } from './rangeFilter';

/** True when the field holds multi-valued cells that filter element-wise. */
export function fieldFiltersByElements(field: Field): boolean {
  return isPillCellField(field) || field.values.some((value) => Array.isArray(value));
}

export function createValuePredicate(
  field: Field,
  values: ValueSetOptions['values'],
  selection?: ValueSetOptions,
  timeZone?: string,
  includeMissing?: boolean
): MatcherConfig {
  return {
    id: 'inSet',
    options: {
      ...selection,
      values,
      mode: 'display',
      displayConfig: field.config,
      timeZone,
      matchElements: fieldFiltersByElements(field) ? true : undefined,
      ...(includeMissing !== undefined ? { includeMissing } : {}),
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

export function unsupportedFilterReason(
  configs: readonly FilterByValueConfig[]
): 'multiple' | 'uneditable' | undefined {
  if (configs.length > 1) {
    return 'multiple';
  }
  return configs.some((config) => !editableValueFilter(config) && !editableRangeFilter(config))
    ? 'uneditable'
    : undefined;
}

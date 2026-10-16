import { isEqual } from 'lodash';

import {
  type DataFrame,
  type DataTransformerConfig,
  type Field,
  type MatcherConfig,
  DataTransformerID,
} from '@grafana/data';
import {
  getRowIdentity,
  FilterByValueType,
  FilterByValueMatch,
  type FilterByValueConfig,
} from '@grafana/data/internal';

export interface RowFilterContext {
  source: DataFrame;
  frameKey: string;
  frameIndex: number;
  field: Field;
  parentIndex?: number;
}

export function tableFilterKey(field: Pick<Field, 'name' | 'labels'>, parentIndex?: number) {
  return JSON.stringify([
    field.name,
    Object.entries(field.labels ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    parentIndex,
  ]);
}

export function matchesTableFilter(config: FilterByValueConfig, field: Field, parentIndex?: number) {
  return (
    config.options.target?.parentIndex === parentIndex &&
    config.options.filters.some((predicate) =>
      predicate.field
        ? predicate.field.name === field.name && isEqual(predicate.field.labels, field.labels)
        : predicate.fieldName === (field.state?.displayName ?? field.name)
    )
  );
}

export function isTableFilter(config: DataTransformerConfig, frameKey: string): config is FilterByValueConfig {
  return config.id === DataTransformerID.filterByValue && config.options.target?.frameKey === frameKey;
}

export function activeFilters(
  configs: readonly DataTransformerConfig[],
  frameKey: string,
  source: DataFrame
): FilterByValueConfig[] {
  return configs.filter((config): config is FilterByValueConfig => {
    if (!isTableFilter(config, frameKey) || config.disabled) {
      return false;
    }
    const target = config.options.target;
    return (
      target?.parentIndex == null ||
      target.parentKey == null ||
      target.parentKey === getRowIdentity(source, target.parentIndex)
    );
  });
}

export function readFieldFilters(configs: readonly DataTransformerConfig[], context: RowFilterContext) {
  return activeFilters(configs, context.frameKey, context.source).filter((config) =>
    matchesTableFilter(config, context.field, context.parentIndex)
  );
}

export function writeTableFilter(
  current: readonly DataTransformerConfig[],
  predicate: MatcherConfig,
  { source, frameKey, frameIndex, field, parentIndex }: RowFilterContext
): readonly DataTransformerConfig[] {
  const selected = readFieldFilters(current, { source, frameKey, frameIndex, field, parentIndex });
  const previous = selected[0];
  const next: FilterByValueConfig = previous
    ? {
        ...previous,
        options: { ...previous.options, filters: [{ ...previous.options.filters[0], config: predicate }] },
      }
    : {
        id: DataTransformerID.filterByValue,
        options: {
          type: FilterByValueType.include,
          match: FilterByValueMatch.all,
          missingField: 'ignore',
          target: {
            frameKey,
            frameIndex,
            refId: source.refId,
            parentIndex,
            parentKey: parentIndex == null ? undefined : getRowIdentity(source, parentIndex),
          },
          filters: [
            {
              fieldName: field.state?.displayName ?? field.name,
              field: { name: field.name, labels: field.labels },
              config: predicate,
            },
          ],
        },
      };
  if (previous) {
    return current.map((config) => (config === previous ? next : config));
  }
  // Child predicates must run before parent rows are removed; all filters precede organization.
  const insertion = current.findIndex(
    (config) =>
      config.id !== DataTransformerID.filterByValue ||
      (parentIndex != null && config.options.target?.parentIndex == null)
  );
  const index = insertion < 0 ? current.length : insertion;
  return [...current.slice(0, index), next, ...current.slice(index)];
}

export function clearFieldFilter(current: readonly DataTransformerConfig[], context: RowFilterContext) {
  const selected = readFieldFilters(current, context);
  return selected.length ? current.filter((config) => !selected.some((selected) => selected === config)) : current;
}

export function clearFrameFilters(current: readonly DataTransformerConfig[], frameKey: string) {
  const next = current.filter((config) => !isTableFilter(config, frameKey) || config.disabled);
  return next.length === current.length ? current : next;
}

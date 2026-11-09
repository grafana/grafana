import { isEqual } from 'lodash';
import { useCallback, useMemo } from 'react';

import { FieldType, type Field, type MatcherConfig } from '@grafana/data';

import { type TableFilterInteraction, type TableNGProps } from '../types';

import {
  activeFilters,
  matchesTableFilter,
  clearFieldFilter,
  clearFrameFilters,
  writeTableFilter,
} from './filterByValue';
import { editableRangeFilter } from './rangeFilter';
import { useTableTransformations } from './useTableTransformations';
import { editableValueFilter } from './valueFilter';

export function useRowTransformations(props: TableNGProps) {
  const { api, owner = '' } = props.rowTransformations ?? {};
  const source = props.data;
  const onInteraction = props.onFilterInteraction;
  const filterType = api ? 'transformation' : 'local';
  const frameIndex = props.rowTransformations?.frameIndex ?? 0;
  const configuredFrameKey = props.rowTransformations?.frameKey ?? props.localFilterScope;
  const frameKey = useMemo(
    () =>
      configuredFrameKey ??
      JSON.stringify([
        source.refId,
        source.name,
        props.structureRev,
        source.fields.map((field) => [field.name, field.type, field.labels]),
      ]),
    [configuredFrameKey, source, props.structureRev]
  );

  const { transformations: configs, update } = useTableTransformations(api, owner, true);
  const filters = useMemo(() => activeFilters(configs, frameKey, source), [configs, frameKey, source]);
  const getFilters = useCallback(
    (field: Field, parentIndex?: number) => filters.filter((config) => matchesTableFilter(config, field, parentIndex)),
    [filters]
  );
  const applyFilter = useCallback(
    (field: Field, predicate: MatcherConfig, parentIndex?: number) => {
      update(
        (current) => {
          const context = { source, frameKey, frameIndex, field, parentIndex };
          const selected = activeFilters(current, frameKey, source).filter((config) =>
            matchesTableFilter(config, field, parentIndex)
          );
          // Compound or unfamiliar predicates must survive edits from a simpler editor unchanged.
          if (
            selected.length > 1 ||
            selected.some((config) => !editableValueFilter(config) && !editableRangeFilter(config))
          ) {
            return current;
          }
          const next = writeTableFilter(current, predicate, context);
          return isEqual(current, next) ? current : next;
        },
        () => onInteraction?.({ action: 'apply', filter_type: filterType, filter_kind: filterKind(field, predicate) })
      );
    },
    [update, source, frameKey, frameIndex, onInteraction, filterType]
  );
  const clearFilter = useCallback(
    (field: Field, parentIndex?: number) => {
      let kind: TableFilterInteraction['filter_kind'] = 'other';
      update(
        (current) => {
          const selected = activeFilters(current, frameKey, source).filter((config) =>
            matchesTableFilter(config, field, parentIndex)
          );
          if (selected.length === 1 && selected[0].options.filters.length === 1) {
            kind = filterKind(field, selected[0].options.filters[0].config);
          }
          const next = clearFieldFilter(current, { source, frameKey, frameIndex, field, parentIndex });
          return isEqual(current, next) ? current : next;
        },
        () => onInteraction?.({ action: 'remove', filter_type: filterType, filter_kind: kind })
      );
    },
    [update, source, frameKey, frameIndex, onInteraction, filterType]
  );
  const clearFilters = useCallback(() => update((current) => clearFrameFilters(current, frameKey)), [update, frameKey]);
  const value = useMemo(
    () => ({
      filters,
      getFilters,
      applyFilter,
      clearFilter,
      clearFilters,
      rangeFiltersEnabled: props.rangeFiltersEnabled,
    }),
    [filters, getFilters, applyFilter, clearFilter, clearFilters, props.rangeFiltersEnabled]
  );
  return { configs, value };
}

function filterKind(field: Field, predicate: MatcherConfig): TableFilterInteraction['filter_kind'] {
  if (predicate.id === 'between') {
    return field.type === FieldType.time ? 'date_range' : 'numeric_range';
  }
  return predicate.id === 'inSet' ? 'values' : 'other';
}

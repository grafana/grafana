import { isEqual } from 'lodash';
import { useCallback, useMemo } from 'react';

import { type Field, type MatcherConfig } from '@grafana/data';

import { type TableNGProps } from '../types';

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
      update((current) => {
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
      });
    },
    [update, source, frameKey, frameIndex]
  );
  const clearFilter = useCallback(
    (field: Field, parentIndex?: number) =>
      update((current) => clearFieldFilter(current, { source, frameKey, frameIndex, field, parentIndex })),
    [update, source, frameKey, frameIndex]
  );
  const clearFilters = useCallback(() => update((current) => clearFrameFilters(current, frameKey)), [update, frameKey]);
  const value = useMemo(
    () => ({ filters, getFilters, applyFilter, clearFilter, clearFilters, timeZone: props.timeZone }),
    [filters, getFilters, applyFilter, clearFilter, clearFilters, props.timeZone]
  );
  return { configs, value };
}

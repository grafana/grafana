import { createContext, useContext, useMemo } from 'react';

import { type Field, type MatcherConfig } from '@grafana/data';
import { type FilterByValueConfig } from '@grafana/data/internal';
import { faro } from '@grafana/faro-web-sdk';

import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';
import { type PanelRuntimeTransformations } from '../../PanelChrome/PanelContext';

import { matchesTableFilter } from './transformations/filterByValue';
import { TableFilterEvaluationError } from './transformations/rowProjection';
import { useRowTransformations } from './transformations/useRowTransformations';
import { unsupportedFilterReason } from './transformations/valueFilter';
import { type TableNGProps } from './types';

export interface TableRowTransformations {
  api: PanelRuntimeTransformations;
  owner: string;
  frameKey: string;
  frameIndex?: number;
}
interface FilterContext {
  filters: readonly FilterByValueConfig[];
  filteringDisabled?: boolean;
  rangeFiltersEnabled?: boolean;
  getFilters: (field: Field, parentIndex?: number) => readonly FilterByValueConfig[];
  applyFilter: (field: Field, predicate: MatcherConfig, parentIndex?: number) => void;
  clearFilter: (field: Field, parentIndex?: number) => void;
  clearFilters: () => void;
  timeZone?: string;
}
const TableFilterContext = createContext<FilterContext | undefined>(undefined);
export const useTableFilters = () => useContext(TableFilterContext);
export function useHeaderFilterState() {
  const filters = useTableFilters()?.filters;
  return useMemo(
    () =>
      filters
        ? (field: Field, parentCount?: number) => {
            const selectedByParent = new Map<number | undefined, FilterByValueConfig[]>();
            for (const config of filters) {
              const parentIndex = config.options.target?.parentIndex;
              if (
                (parentCount === undefined
                  ? parentIndex === undefined
                  : parentIndex !== undefined && parentIndex >= 0 && parentIndex < parentCount) &&
                matchesTableFilter(config, field, parentIndex)
              ) {
                const selected = selectedByParent.get(parentIndex) ?? [];
                selected.push(config);
                selectedByParent.set(parentIndex, selected);
              }
            }
            let controlVisible =
              parentCount === undefined ? !selectedByParent.has(undefined) : selectedByParent.size < parentCount;
            let filterEnabled = false;
            for (const selected of selectedByParent.values()) {
              if (!unsupportedFilterReason(selected)) {
                controlVisible = true;
                filterEnabled = true;
              }
            }
            return { controlVisible, filterEnabled };
          }
        : undefined,
    [filters]
  );
}

export function TableFilterProvider({ props, children }: { props: TableNGProps; children: React.ReactNode }) {
  const { configs, value } = useRowTransformations(props);
  return (
    <ErrorBoundary
      // A new frame, revision, or saved view gets one fresh attempt at filtering.
      dependencies={[configs, props.data, props.structureRev, props.rowTransformations?.frameKey]}
      errorLogger={(error) => {
        if (error instanceof TableFilterEvaluationError) {
          faro?.api?.pushError(error.originalError, { context: { source: 'TableNG.filter' } });
        }
      }}
      onError={(error) => {
        if (error instanceof TableFilterEvaluationError) {
          props.onFilterError?.(error.originalError);
        }
      }}
    >
      {({ error }) => {
        if (error && !(error instanceof TableFilterEvaluationError)) {
          throw error;
        }
        const filteringDisabled = Boolean(error);
        const context = filteringDisabled
          ? {
              ...value,
              filters: [],
              filteringDisabled,
              getFilters: () => [],
              applyFilter: () => {},
              clearFilter: () => {},
              clearFilters: () => {},
            }
          : value;
        return (
          <TableFilterContext.Provider value={{ ...context, rangeFiltersEnabled: props.rangeFiltersEnabled }}>
            {children}
          </TableFilterContext.Provider>
        );
      }}
    </ErrorBoundary>
  );
}

import { createContext, useContext, useMemo } from 'react';

import { type Field, type MatcherConfig } from '@grafana/data';
import { type FilterByValueConfig } from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import { Button } from '../../Button/Button';
import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';
import { type PanelRuntimeTransformations } from '../../PanelChrome/PanelContext';

import { matchesTableFilter } from './transformations/filterByValue';
import { useRowTransformations } from './transformations/useRowTransformations';
import { type TableNGProps } from './types';

export interface TableRowTransformations {
  api: PanelRuntimeTransformations;
  owner: string;
  frameKey: string;
  frameIndex?: number;
}
interface FilterContext {
  filters: readonly FilterByValueConfig[];
  getFilters: (field: Field, parentIndex?: number) => readonly FilterByValueConfig[];
  applyFilter: (field: Field, predicate: MatcherConfig, parentIndex?: number) => void;
  clearFilter: (field: Field, parentIndex?: number) => void;
  clearFilters: () => void;
}
const TableFilterContext = createContext<FilterContext | undefined>(undefined);
export const useTableFilters = () => useContext(TableFilterContext);
export function useIsFieldFiltered() {
  const filters = useTableFilters()?.filters;
  return useMemo(
    () =>
      filters
        ? (field: Field) =>
            filters.some((config) => matchesTableFilter(config, field, config.options.target?.parentIndex))
        : undefined,
    [filters]
  );
}

export function TableFilterProvider({ props, children }: { props: TableNGProps; children: React.ReactNode }) {
  const { configs, value } = useRowTransformations(props);
  const { clearFilters } = value;
  return (
    <TableFilterContext.Provider value={value}>
      <ErrorBoundary dependencies={[configs, props.data]}>
        {({ error }) =>
          error ? (
            <div role="alert">
              {t('grafana-ui.table.view.error', 'Unable to apply this table view.')}
              <Button onClick={clearFilters}>{t('grafana-ui.table.view.reset', 'Reset view')}</Button>
            </div>
          ) : (
            children
          )
        }
      </ErrorBoundary>
    </TableFilterContext.Provider>
  );
}

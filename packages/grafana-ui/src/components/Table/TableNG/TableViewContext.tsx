import { createContext, useContext, useMemo } from 'react';

import { type Field, type MatcherConfig } from '@grafana/data';
import { type FilterByValueConfig } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
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
interface ViewContext {
  filters: readonly FilterByValueConfig[];
  getFilters: (field: Field, parentIndex?: number) => readonly FilterByValueConfig[];
  applyFilter: (field: Field, predicate: MatcherConfig, parentIndex?: number) => void;
  clearFilter: (field: Field, parentIndex?: number) => void;
  clearFilters: () => void;
  timeZone?: string;
}
const TableViewContext = createContext<ViewContext | undefined>(undefined);
export const useTableView = () => useContext(TableViewContext);
export function useIsFieldFiltered() {
  const filters = useTableView()?.filters;
  return useMemo(
    () =>
      filters
        ? (field: Field) =>
            filters.some((config) => matchesTableFilter(config, field, config.options.target?.parentIndex))
        : undefined,
    [filters]
  );
}

export function TableViewProvider({ props, children }: { props: TableNGProps; children: React.ReactNode }) {
  const { configs, value } = useRowTransformations(props);
  const { filters, clearFilters } = value;
  return (
    <TableViewContext.Provider value={value}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {filters.length > 0 && (
          <div style={{ flex: '0 0 auto', padding: '4px 8px' }}>
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              icon="filter"
              onClick={clearFilters}
              data-testid={selectors.components.Panels.Visualization.TableNG.Filters.clearAll}
            >
              {t('grafana-ui.table.view.clear', 'Clear filters ({{total}})', { total: filters.length })}
            </Button>
          </div>
        )}
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
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
        </div>
      </div>
    </TableViewContext.Provider>
  );
}

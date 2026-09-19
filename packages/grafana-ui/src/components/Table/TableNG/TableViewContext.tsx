import { isEqual } from 'lodash';
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';

import {
  type DataFrame,
  type DataTransformerConfig,
  type Field,
  cacheFieldDisplayNames,
  DataTransformerID,
  type MatcherConfig,
} from '@grafana/data';
import {
  tableFrameKey,
  tableParentKey,
  tableViewIndices,
  FilterByValueType,
  FilterByValueMatch,
  type FilterByValueConfig,
} from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Button } from '../../Button/Button';
import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';
import { type AdHocTransformationsApi } from '../../PanelChrome/PanelContext';

import { type TableNGProps, type TableRow } from './types';
import { type ApplyFilterResult } from './utils';

export interface TableRowTransformations {
  api: AdHocTransformationsApi;
  frameKey: string;
}
interface ViewContext {
  filters: readonly FilterByValueConfig[];
  getFilters: (field: Field, parentIndex?: number) => readonly FilterByValueConfig[];
  applyFilter: (field: Field, predicate: MatcherConfig, parentIndex?: number) => void;
  clearFilter: (field: Field, parentIndex?: number) => void;
  clearFilters: () => void;
  timeZone?: string;
}
export const TableViewContext = createContext<ViewContext | undefined>(undefined);
export const useTableView = () => useContext(TableViewContext);
const EMPTY_STAGE: readonly DataTransformerConfig[] = [];

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

export function editableTableFilter(config: FilterByValueConfig) {
  const predicate = config.options.filters[0];
  return (
    config.options.type === FilterByValueType.include &&
    config.options.filters.length === 1 &&
    (predicate.config.id === 'numericRange' ||
      (predicate.config.id === 'inSet' && predicate.config.options.mode === 'display'))
  );
}

function isTableFilter(config: DataTransformerConfig, frameKey: string): config is FilterByValueConfig {
  return config.id === DataTransformerID.filterByValue && config.options.target?.frameKey === frameKey;
}

function activeFilters(
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
      target.parentKey === tableParentKey(source, target.parentIndex)
    );
  });
}

export function TableViewProvider({ props, children }: { props: TableNGProps; children: React.ReactNode }) {
  const { api } = props.rowTransformations ?? {};
  const source = props.data;
  const frameKey = props.rowTransformations?.frameKey ?? tableFrameKey([source], 0);
  const stage = useSyncExternalStore(
    useCallback((listener) => api?.subscribe(listener) ?? (() => {}), [api]),
    useCallback(() => api?.get() ?? EMPTY_STAGE, [api])
  );
  const [local, setLocal] = useState<readonly DataTransformerConfig[]>(EMPTY_STAGE);
  const configs = api ? stage : local;
  const update = useCallback(
    (fn: (current: readonly DataTransformerConfig[]) => readonly DataTransformerConfig[]) => {
      if (!api) {
        setLocal((current) => {
          const next = fn(current);
          return isEqual(current, next) ? current : next;
        });
        return;
      }
      const current = api.get();
      const next = fn(current);
      if (!isEqual(current, next)) {
        api.set(next);
      }
    },
    [api]
  );
  const filters = useMemo(() => activeFilters(configs, frameKey, source), [configs, frameKey, source]);
  const getFilters = useCallback(
    (field: Field, parentIndex?: number) => filters.filter((config) => matchesTableFilter(config, field, parentIndex)),
    [filters]
  );
  const applyFilter = useCallback(
    (field: Field, predicate: MatcherConfig, parentIndex?: number) => {
      update((current) => {
        const selected = activeFilters(current, frameKey, source).filter((config) =>
          matchesTableFilter(config, field, parentIndex)
        );
        // Never flatten a compound or unfamiliar predicate through the simpler table editor.
        if (selected.length > 1 || selected.some((config) => !editableTableFilter(config))) {
          return current;
        }
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
                  parentIndex,
                  parentKey: parentIndex == null ? undefined : tableParentKey(source, parentIndex),
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
        // Child predicates must run before parent rows are removed; all filters precede sorting and organization.
        const insertion = current.findIndex(
          (config) =>
            config.id !== DataTransformerID.filterByValue ||
            (parentIndex != null && config.options.target?.parentIndex == null)
        );
        const index = insertion < 0 ? current.length : insertion;
        return [...current.slice(0, index), next, ...current.slice(index)];
      });
    },
    [update, frameKey, source]
  );
  const clearFilter = useCallback(
    (field: Field, parentIndex?: number) =>
      update((current) => {
        const selected = activeFilters(current, frameKey, source).filter((config) =>
          matchesTableFilter(config, field, parentIndex)
        );
        return current.filter((config) => !selected.some((selected) => selected === config));
      }),
    [update, frameKey, source]
  );
  const clearFilters = useCallback(
    () => update((current) => current.filter((config) => !isTableFilter(config, frameKey) || config.disabled)),
    [update, frameKey]
  );
  const value = useMemo(
    () => ({ filters, getFilters, applyFilter, clearFilter, clearFilters, timeZone: props.timeZone }),
    [filters, getFilters, applyFilter, clearFilter, clearFilters, props.timeZone]
  );
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

export function transformTableRows(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): TableRow[] {
  if (!filters.length) {
    return rows;
  }
  const parents = rows.filter((row) => row.__depth === 0);
  const frame: DataFrame = {
    length: parents.length,
    fields: fields.map((field) => ({
      ...field,
      values: parents.map((row) => field.values[row.__index]),
      ...(field.nanos ? { nanos: parents.map((row) => field.nanos![row.__index]) } : {}),
    })),
  };
  cacheFieldDisplayNames([frame]);
  const indices = tableViewIndices(frame, filters, parentIndex);
  const children = new Map(rows.filter((row) => row.__depth !== 0).map((row) => [row.__index, row]));
  return indices.flatMap((index) => {
    const row = parents[index];
    const child = children.get(row.__index);
    return child ? [row, child] : [row];
  });
}

export function transformTableFilters(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): ApplyFilterResult {
  const scoped = filters.filter((config) => config.options.target?.parentIndex === parentIndex);
  const entries = fields.flatMap((field) => {
    const selected = scoped.filter((config) => matchesTableFilter(config, field, parentIndex));
    return selected.length
      ? [
          [
            tableFilterKey(field, parentIndex),
            transformTableRows(
              rows,
              fields,
              filters.filter((config) => !selected.includes(config)),
              parentIndex
            ),
          ] as const,
        ]
      : [];
  });
  const crossFilterOrder = entries.map(([key]) => key);
  const crossFilterRows = Object.fromEntries(entries);
  const filteredRows = transformTableRows(rows, fields, filters, parentIndex);
  return { filteredRows, crossFilterOrder, crossFilterRows, crossFilterTailRows: filteredRows };
}

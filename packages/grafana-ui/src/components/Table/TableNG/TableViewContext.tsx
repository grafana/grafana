import { isEqual } from 'lodash';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
  useState,
  useSyncExternalStore,
} from 'react';

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
  type SortByTransformerOptions,
} from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SortColumn } from '@grafana/react-data-grid';
import { type VizPanelRuntimeTransformations } from '@grafana/scenes';

import { Button } from '../../Button/Button';
import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';

import { type TableNGProps, type TableRow } from './types';
import { type ApplyFilterResult } from './utils';

export interface TableRowTransformations {
  api: VizPanelRuntimeTransformations;
  owner: string;
  frameKey: string;
}
interface ViewContext {
  filters: readonly FilterByValueConfig[];
  sortColumns: SortColumn[];
  setSortColumns: Dispatch<SetStateAction<SortColumn[]>>;
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
  const { api, owner = '' } = props.rowTransformations ?? {};
  const source = props.data;
  const frameKey = props.rowTransformations?.frameKey ?? tableFrameKey([source], 0);
  const stage = useSyncExternalStore(
    useCallback((listener) => api?.subscribe(owner, listener) ?? (() => {}), [api, owner]),
    useCallback(() => api?.get(owner) ?? EMPTY_STAGE, [api, owner])
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
      const current = api.get(owner);
      const next = fn(current);
      if (!isEqual(current, next)) {
        api.set(owner, next);
      }
    },
    [api, owner]
  );
  const filters = useMemo(() => activeFilters(configs, frameKey, source), [configs, frameKey, source]);
  const initialSort = useRef(props.sortBy);
  const initial = useMemo<SortByTransformerOptions>(
    () => ({
      sort: (initialSort.current ?? []).map((s) => ({ field: s.displayName, desc: s.desc })),
      table: true,
      target: { frameKey },
    }),
    [frameKey]
  );
  const readSort = useCallback(
    (current: readonly DataTransformerConfig[]): SortByTransformerOptions =>
      current.find(
        (config) =>
          config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey && !config.disabled
      )?.options ?? initial,
    [frameKey, initial]
  );
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
        const stage =
          initial.sort.length &&
          !current.some(
            (config) => config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey
          )
            ? [
                ...current.filter((config) => config.id === DataTransformerID.filterByValue),
                { id: DataTransformerID.sortBy, options: initial },
                ...current.filter((config) => config.id !== DataTransformerID.filterByValue),
              ]
            : current;
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
          return stage.map((config) => (config === previous ? next : config));
        }
        // Child predicates must run before parent rows are removed; all filters precede sorting and organization.
        const insertion = stage.findIndex(
          (config) =>
            config.id !== DataTransformerID.filterByValue ||
            (parentIndex != null && config.options.target?.parentIndex == null)
        );
        const index = insertion < 0 ? stage.length : insertion;
        return [...stage.slice(0, index), next, ...stage.slice(index)];
      });
    },
    [update, frameKey, source, initial]
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
  const sortColumns = useMemo<SortColumn[]>(
    () =>
      readSort(configs).sort.map((s) => ({
        columnKey: s.displayName ?? s.field,
        direction: s.desc ? 'DESC' : 'ASC',
      })),
    [configs, readSort]
  );
  const setSortColumns = useCallback<Dispatch<SetStateAction<SortColumn[]>>>(
    (action) =>
      update((current) => {
        const previous: SortColumn[] = readSort(current).sort.map((s) => ({
          columnKey: s.displayName ?? s.field,
          direction: s.desc ? 'DESC' : 'ASC',
        }));
        const next = typeof action === 'function' ? action(previous) : action;
        const rest = current.filter(
          (config) => !(config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey)
        );
        const sorted: DataTransformerConfig<SortByTransformerOptions> = {
          id: DataTransformerID.sortBy,
          options: {
            table: true,
            target: { frameKey },
            sort: next.map((s) => ({
              field:
                props.data.fields.find((f) => (f.state?.displayName ?? f.name) === s.columnKey)?.name ?? s.columnKey,
              displayName: s.columnKey,
              fieldLabels: props.data.fields.find((f) => (f.state?.displayName ?? f.name) === s.columnKey)?.labels,
              desc: s.direction === 'DESC',
            })),
          },
        };
        // Filtering must finish before sorting can change nested parent indices.
        return [
          ...rest.filter((config) => config.id === DataTransformerID.filterByValue),
          sorted,
          ...rest.filter((config) => config.id !== DataTransformerID.filterByValue),
        ];
      }),
    [update, readSort, frameKey, props.data.fields]
  );
  const value = useMemo(
    () => ({
      filters,
      getFilters,
      applyFilter,
      clearFilter,
      clearFilters,
      sortColumns,
      setSortColumns,
      timeZone: props.timeZone,
    }),
    [filters, getFilters, applyFilter, clearFilter, clearFilters, sortColumns, setSortColumns, props.timeZone]
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
                  <Button
                    onClick={() => {
                      clearFilters();
                      setSortColumns([]);
                    }}
                  >
                    {t('grafana-ui.table.view.reset', 'Reset view')}
                  </Button>
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
  sort: SortColumn[] = [],
  parentIndex?: number
): TableRow[] {
  if (!filters.length && !sort.length) {
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
  const indices = tableViewIndices(
    frame,
    filters,
    parentIndex,
    sort.map((s) => ({ field: s.columnKey, desc: s.direction === 'DESC' }))
  );
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
              [],
              parentIndex
            ),
          ] as const,
        ]
      : [];
  });
  const crossFilterOrder = entries.map(([key]) => key);
  const crossFilterRows = Object.fromEntries(entries);
  const filteredRows = transformTableRows(rows, fields, filters, [], parentIndex);
  return { filteredRows, crossFilterOrder, crossFilterRows, crossFilterTailRows: filteredRows };
}

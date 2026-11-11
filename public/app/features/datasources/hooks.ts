import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { useLocalStorage } from 'react-use';
import { type Observable } from 'rxjs';

import { type DataSourceInstanceSettings, type DataSourceRef, type ScopedVars } from '@grafana/data';
import { type DataSourceSrv, type GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';

function countAvailableDataSources(srv: DataSourceSrv): number {
  if ('getAll' in srv) {
    const getAll: unknown = srv.getAll;
    if (typeof getAll === 'function') {
      const result: unknown = getAll.call(srv);
      if (Array.isArray(result)) {
        return result.length;
      }
    }
  }
  return 0;
}

const LOCAL_STORAGE_KEY = 'grafana.features.datasources.components.picker.DataSourceDropDown.history';

/**
 * Stores the uid of the last 5 data sources selected by the user. The last UID is the one most recently used.
 */
export function useRecentlyUsedDataSources(): [string[], (ds: DataSourceInstanceSettings) => void] {
  const [value = [], setStorage] = useLocalStorage<string[]>(LOCAL_STORAGE_KEY, []);

  const pushRecentlyUsedDataSource = useCallback(
    (ds: DataSourceInstanceSettings) => {
      if (ds.meta.builtIn) {
        // Prevent storing the built in datasources (-- Grafana --, -- Mixed --,  -- Dashboard --)
        return;
      }
      if (value.includes(ds.uid)) {
        // Prevent storing multiple copies of the same data source, put it at the front of the array instead.
        value.splice(
          value.findIndex((dsUid) => ds.uid === dsUid),
          1
        );
        setStorage([...value, ds.uid]);
      } else {
        const newArray = [...value, ds.uid];
        if (newArray.length > 5) {
          setStorage(newArray.slice(1, 6));
        } else {
          setStorage(newArray);
        }
      }
    },
    [value, setStorage]
  );

  return [value, pushRecentlyUsedDataSource];
}

export function useDatasources(filters: GetDataSourceListFilters, datasources?: DataSourceInstanceSettings[]) {
  const dataSourceSrv = getDataSourceSrv();
  const filtersKey = useMemo(() => JSON.stringify(filters ?? null), [filters]);
  const availableDataSourceCount = datasources ? datasources.length : countAvailableDataSources(dataSourceSrv);

  return useMemo(() => {
    if (datasources) {
      return datasources;
    }
    return dataSourceSrv.getList(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, availableDataSourceCount, datasources]);
}

export function useDatasource(
  dataSource: string | DataSourceRef | DataSourceInstanceSettings | null | undefined,
  scopedVars?: ScopedVars
) {
  const dataSourceSrv = getDataSourceSrv();

  if (typeof dataSource === 'string') {
    return dataSourceSrv.getInstanceSettings(dataSource, scopedVars);
  }

  return dataSourceSrv.getInstanceSettings(dataSource, scopedVars);
}

export interface KeyboardNavigatableListProps {
  keyboardEvents?: Observable<React.KeyboardEvent>;
  itemCount: number;
  scrollToIndex?: (index: number) => void;
  onSelect?: (index: number) => void;
}

/**
 * Index-based keyboard navigation for (virtualized) lists.
 * Returns the currently selected index.
 */
export function useKeyboardNavigatableList(props: KeyboardNavigatableListProps): number {
  const { keyboardEvents, itemCount } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(0);
  const scrollToIndexRef = useRef(props.scrollToIndex);
  const onSelectRef = useRef(props.onSelect);

  scrollToIndexRef.current = props.scrollToIndex;
  onSelectRef.current = props.onSelect;

  // Reset selection when item count changes (e.g. filtering)
  useEffect(() => {
    selectedIndexRef.current = 0;
    setSelectedIndex(0);
  }, [itemCount]);

  useEffect(() => {
    if (!keyboardEvents) {
      return;
    }
    const sub = keyboardEvents.subscribe({
      next: (keyEvent) => {
        switch (keyEvent?.code) {
          case 'ArrowDown': {
            const next = itemCount > 0 ? (selectedIndexRef.current + 1) % itemCount : 0;
            selectedIndexRef.current = next;
            setSelectedIndex(next);
            scrollToIndexRef.current?.(next);
            keyEvent.preventDefault();
            break;
          }
          case 'ArrowUp': {
            const next = selectedIndexRef.current > 0 ? selectedIndexRef.current - 1 : selectedIndexRef.current;
            selectedIndexRef.current = next;
            setSelectedIndex(next);
            scrollToIndexRef.current?.(next);
            keyEvent.preventDefault();
            break;
          }
          case 'Enter':
            onSelectRef.current?.(selectedIndexRef.current);
            break;
        }
      },
    });
    return () => sub.unsubscribe();
  }, [keyboardEvents, itemCount]);

  return selectedIndex;
}

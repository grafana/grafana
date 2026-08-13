import { useCallback, useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { useAsync, useLocalStorage } from 'react-use';
import { type Observable } from 'rxjs';

import { type DataSourceInstanceSettings, type DataSourceRef, type ScopedVars } from '@grafana/data';
import { type GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';
import {
  type GetDataSourceInstanceListFilters,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';

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

/**
 * @deprecated Use {@link useDatasourcesAsync} instead — call sites are being migrated to it
 * one by one, and once all are done it takes over this hook's name.
 */
export function useDatasources(filters: GetDataSourceListFilters, datasources?: DataSourceInstanceSettings[]) {
  if (datasources) {
    return datasources;
  }
  const dataSourceSrv = getDataSourceSrv();
  const dataSources = dataSourceSrv.getList(filters);

  return dataSources;
}

export interface UseDatasourcesAsyncResult {
  isLoading: boolean;
  error?: Error;
  dataSources: DataSourceInstanceSettings[];
}

/**
 * Async replacement for {@link useDatasources}, resolving the data sources matching `filters`
 * from the in-memory cache with explicit loading and error state. While a re-fetch is pending,
 * the previous list is kept with `isLoading: true`.
 *
 * Known limitation: the result is only re-fetched when `filters` change, so a mounted consumer
 * does not pick up data sources added or removed via reloadDataSourceInstanceSettings() until
 * it remounts or its filters change.
 */
export function useDatasourcesAsync(filters: GetDataSourceInstanceListFilters = {}): UseDatasourcesAsyncResult {
  // Consumers pass `filters` as an inline object literal — a new reference on every render.
  // Serialize it for the useAsync() deps so the fetch only re-runs when a filter value
  // actually changes. The `filter` callback can't be serialized; it is compared by reference.
  const { filter: filterFunc, ...serializableFilters } = filters;
  const filtersKey = JSON.stringify(serializableFilters);

  const { loading, error, value } = useAsync(
    async () => {
      const items = await getDataSourceInstanceList(filters);
      // getDataSourceInstanceList() returns slim list items, but the pickers built on this
      // hook pass full DataSourceInstanceSettings to their public onChange/filter props, so
      // fetch the full settings for each item. Both calls read the same in-memory cache.
      const settings = await Promise.all(items.map((item) => getDataSourceInstanceSettings(item.uid)));
      return settings.filter((s) => s !== undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey, filterFunc]
  );

  return { isLoading: loading, error, dataSources: value ?? [] };
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

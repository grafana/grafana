import React, { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from 'react-use';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';
import { GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';

export const LOCAL_STORAGE_KEY = 'grafana.features.datasources.components.picker.DataSourceDropDown.history';

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
        setStorage([...value, ds.uid].slice(1, 6));
      }
    },
    [value, setStorage]
  );

  return [value, pushRecentlyUsedDataSource];
}

export function useDatasources(filters: GetDataSourceListFilters) {
  const dataSourceSrv = getDataSourceSrv();
  const dataSources = dataSourceSrv.getList(filters);

  return dataSources;
}

export function useDatasource(dataSource: string | DataSourceRef | DataSourceInstanceSettings | null | undefined) {
  const dataSourceSrv = getDataSourceSrv();

  if (!dataSource) {
    return undefined;
  }

  if (typeof dataSource === 'string') {
    return dataSourceSrv.getInstanceSettings(dataSource);
  }

  return dataSourceSrv.getInstanceSettings(dataSource);
}

export interface KeybaordNavigatableListProps {
  keyboardEvents?: Observable<React.KeyboardEvent>;
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * Allows navigating lists of elements where the data-role attribute is set to "keyboardSelectableItem"
 * @param props
 */
export function useKeyboardNavigatableList(props: KeybaordNavigatableListProps) {
  const { keyboardEvents, containerRef } = props;
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    const menuItems = containerRef?.current?.querySelectorAll<HTMLElement | HTMLButtonElement | HTMLAnchorElement>(
      '[data-role="keyboardSelectableItem"]'
    );

    const selectedItem = menuItems?.item(selectedIndex % menuItems?.length);

    menuItems?.forEach((mi) => mi.setAttribute('data-selectedItem', 'false'));

    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'center' });
      selectedItem.setAttribute('data-selectedItem', 'true');
    }
  }, [selectedIndex, containerRef]);

  const select = () => {
    containerRef?.current
      ?.querySelectorAll<HTMLElement | HTMLButtonElement | HTMLAnchorElement>('[data-role="keyboardSelectableItem"]') //Could instead maybe select by [data-selected="true"]
      .item(selectedIndex)
      .querySelector<HTMLButtonElement>('button') // This is a bit weird. The main use for this would be to select card items, however the root of the card component does not have the click event handler, instead it's attached to a button inside it.
      ?.click();
  };

  useEffect(() => {
    console.log(keyboardEvents);
    if (!keyboardEvents) {
      return;
    }
    const sub = keyboardEvents.subscribe({
      next: (keyEvent) => {
        switch (keyEvent?.code) {
          case 'ArrowDown': {
            setSelectedIndex(selectedIndex + 1);
            keyEvent.preventDefault();
            break;
          }
          case 'ArrowUp':
            setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : selectedIndex);
            keyEvent.preventDefault();
            break;
          case 'Enter':
            select();
            break;
        }
      },
    });
    return () => sub.unsubscribe();
  });
}

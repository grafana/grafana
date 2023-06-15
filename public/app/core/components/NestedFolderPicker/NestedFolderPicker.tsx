import React, { useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { Button, FilterInput, LoadingBar } from '@grafana/ui';
import { listFolders, PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { createFlatTree } from 'app/features/browse-dashboards/state';
import { DashboardsTreeItem, DashboardViewItemCollection } from 'app/features/browse-dashboards/types';
import { DashboardViewItem } from 'app/features/search/types';

import { NestedFolderList } from './NestedFolderList';

async function fetchRootFolders() {
  return await listFolders(undefined, undefined, 1, PAGE_SIZE);
}

export function NestedFolderPicker() {
  const [search, setSearch] = useState('');

  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>({});
  const [childrenForUID, setChildrenForUID] = useState<Record<string, DashboardViewItem[]>>({});
  const state = useAsync(fetchRootFolders);

  const handleFolderClick = useCallback(async (uid: string, newOpenState: boolean) => {
    console.log('onFolderClick', uid, newOpenState);

    setFolderOpenState((old) => ({ ...old, [uid]: newOpenState }));

    if (newOpenState) {
      const folders = await listFolders(uid, undefined, 1, PAGE_SIZE);
      setChildrenForUID((old) => ({ ...old, [uid]: folders }));
    }
  }, []);

  const flatTree = useMemo(() => {
    const rootCollection: DashboardViewItemCollection = {
      isFullyLoaded: !state.loading,
      lastKindHasMoreItems: false,
      lastFetchedKind: 'folder',
      lastFetchedPage: 1,
      items: state.value ?? [],
    };

    const childrenCollections: Record<string, DashboardViewItemCollection | undefined> = {};

    for (const parentUID in childrenForUID) {
      const children = childrenForUID[parentUID];
      childrenCollections[parentUID] = {
        isFullyLoaded: !!children,
        lastKindHasMoreItems: false,
        lastFetchedKind: 'folder',
        lastFetchedPage: 1,
        items: children,
      };
    }

    const result = createFlatTree(undefined, rootCollection, childrenCollections, folderOpenState, 0, false);

    return result;
  }, [childrenForUID, folderOpenState, state.loading, state.value]);

  return (
    <fieldset>
      <FilterInput placeholder="Search folder" value={search} escapeRegex={false} onChange={(val) => setSearch(val)} />

      {state.loading && <LoadingBar width={300} />}
      {state.error && <p>{state.error.message}</p>}
      {state.value && <NestedFolderList items={flatTree} onFolderClick={handleFolderClick} />}
    </fieldset>
  );
}

import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, FilterInput, LoadingBar, useStyles2 } from '@grafana/ui';
import { listFolders, PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { createFlatTree } from 'app/features/browse-dashboards/state';
import { DashboardViewItemCollection } from 'app/features/browse-dashboards/types';
import { getGrafanaSearcher } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';

import { NestedFolderList } from './NestedFolderList';
import { FolderChange, FolderUID } from './types';

async function fetchRootFolders() {
  return await listFolders(undefined, undefined, 1, PAGE_SIZE);
}

interface NestedFolderPickerProps {
  value?: FolderUID | undefined;
  // TODO: think properly (and pragmatically) about how to communicate moving to general folder,
  // vs removing selection (if possible?)
  onChange?: (folderUID: FolderChange) => void;
}

export function NestedFolderPicker({ value, onChange }: NestedFolderPickerProps) {
  const styles = useStyles2(getStyles);

  const [search, setSearch] = useState('');
  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>({});
  const [childrenForUID, setChildrenForUID] = useState<Record<string, DashboardViewItem[]>>({});
  const rootFoldersState = useAsync(fetchRootFolders);

  const searchState = useAsync(async () => {
    if (!search) {
      return undefined;
    }
    const searcher = getGrafanaSearcher();
    const queryResponse = await searcher.search({
      query: search,
      kind: ['folder'],
      limit: 100,
    });

    const items = queryResponse.view.map((v) => queryResultToViewItem(v, queryResponse.view));

    return { ...queryResponse, items };
  }, [search]);

  const handleFolderClick = useCallback(async (uid: string, newOpenState: boolean) => {
    setFolderOpenState((old) => ({ ...old, [uid]: newOpenState }));

    if (newOpenState) {
      const folders = await listFolders(uid, undefined, 1, PAGE_SIZE);
      setChildrenForUID((old) => ({ ...old, [uid]: folders }));
    }
  }, []);

  const flatTree = useMemo(() => {
    const searchResults = search && searchState.value;
    const rootCollection: DashboardViewItemCollection = searchResults
      ? {
          isFullyLoaded: searchResults.items.length === searchResults.totalRows,
          lastKindHasMoreItems: false, // not relevent for search
          lastFetchedKind: 'folder', // not relevent for search
          lastFetchedPage: 1, // not relevent for search
          items: searchResults.items ?? [],
        }
      : {
          isFullyLoaded: !rootFoldersState.loading,
          lastKindHasMoreItems: false,
          lastFetchedKind: 'folder',
          lastFetchedPage: 1,
          items: rootFoldersState.value ?? [],
        };

    const childrenCollections: Record<string, DashboardViewItemCollection | undefined> = {};

    if (!searchResults) {
      // We don't expand folders when searching
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
    }

    const result = createFlatTree(
      undefined,
      rootCollection,
      childrenCollections,
      searchResults ? {} : folderOpenState,
      searchResults ? 0 : 1,
      false
    );

    if (!searchResults) {
      result.unshift({
        isOpen: true,
        level: 0,
        item: {
          kind: 'folder',
          title: 'Dashboards',
          uid: '',
        },
      });
    }

    return result;
  }, [search, searchState.value, rootFoldersState.loading, rootFoldersState.value, folderOpenState, childrenForUID]);

  const handleSelectionChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>, item: DashboardViewItem) => {
      if (onChange) {
        onChange({ title: item.title, uid: item.uid });
      }
    },
    [onChange]
  );

  const isLoading = rootFoldersState.loading || searchState.loading;
  const error = rootFoldersState.error || searchState.error;

  const tree = flatTree;

  return (
    <fieldset>
      <Stack direction="column" gap={1}>
        <FilterInput
          placeholder="Search folder"
          value={search}
          escapeRegex={false}
          onChange={(val) => setSearch(val)}
        />

        {error && (
          <Alert severity="warning" title="Error loading folders">
            {error.message || error.toString?.() || 'Unknown error'}
          </Alert>
        )}

        <div className={styles.tableWrapper}>
          {isLoading && (
            <div className={styles.loader}>
              <LoadingBar width={600} />
            </div>
          )}

          <NestedFolderList
            items={tree}
            selectedFolder={value}
            onFolderClick={handleFolderClick}
            onSelectionChange={handleSelectionChange}
            foldersAreOpenable={!(search && searchState.value)}
          />
        </div>
      </Stack>
    </fieldset>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableWrapper: css({
      position: 'relative',
      zIndex: 1,
      background: 'palegoldenrod',
    }),

    loader: css({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      overflow: 'hidden', // loading bar overflows its container, so we need to clip it
    }),
  };
};

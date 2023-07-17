import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { usePopperTooltip } from 'react-popper-tooltip';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Icon, Input, LoadingBar, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Trans, t } from 'app/core/internationalization';
import { skipToken, useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
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
  value?: FolderUID;
  // TODO: think properly (and pragmatically) about how to communicate moving to general folder,
  // vs removing selection (if possible?)
  onChange?: (folder: FolderChange) => void;
}

export function NestedFolderPicker({ value, onChange }: NestedFolderPickerProps) {
  const styles = useStyles2(getStyles);

  const [search, setSearch] = useState('');
  const [autoFocusButton, setAutoFocusButton] = useState(false);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>({});
  const [childrenForUID, setChildrenForUID] = useState<Record<string, DashboardViewItem[]>>({});
  const rootFoldersState = useAsync(fetchRootFolders);
  const selectedFolder = useGetFolderQuery(value || skipToken);

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

  const handleFolderExpand = useCallback(async (uid: string, newOpenState: boolean) => {
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

  const { getTooltipProps, setTooltipRef, setTriggerRef, visible, triggerRef } = usePopperTooltip({
    visible: overlayOpen,
    placement: 'bottom',
    interactive: true,
    offset: [0, 0],
    trigger: 'click',
    onVisibleChange: (value: boolean) => {
      // ensure state is clean on opening the overlay
      if (value) {
        setSearch('');
        setFocusedItemIndex(0);
      }
      setOverlayOpen(value);
    },
  });

  const handleFolderSelect = useCallback(
    (item: DashboardViewItem) => {
      if (onChange) {
        onChange({
          uid: item.uid,
          title: item.title,
        });
      }
      setAutoFocusButton(true);
      setOverlayOpen(false);
    },
    [onChange]
  );

  const isLoading = rootFoldersState.loading || searchState.loading;
  const error = rootFoldersState.error || searchState.error;

  const tree = flatTree;

  const handleKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      // Expand/collapse folder on arrow keys
      const foldersAreOpenable = !(search && searchState.value);
      if (foldersAreOpenable && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
        ev.preventDefault();
        handleFolderExpand(tree[focusedItemIndex].item.uid, ev.key === 'ArrowRight');
      } else if (ev.key === 'ArrowUp' && focusedItemIndex > 0) {
        ev.preventDefault();
        const nextIndex = focusedItemIndex - 1;
        setFocusedItemIndex(nextIndex);
      } else if (ev.key === 'ArrowDown' && focusedItemIndex < tree.length - 1) {
        ev.preventDefault();
        const nextIndex = focusedItemIndex + 1;
        setFocusedItemIndex(nextIndex);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const item = tree[focusedItemIndex].item;
        if (item.kind === 'folder') {
          handleFolderSelect(item);
        }
      } else if (ev.key === 'Tab' || ev.key === 'Escape') {
        ev.stopPropagation();
        setOverlayOpen(false);
      }
    },
    [focusedItemIndex, handleFolderExpand, handleFolderSelect, search, searchState.value, tree]
  );

  useEffect(() => {
    setFocusedItemIndex(0);
  }, [search, searchState.value]);

  let label = selectedFolder.data?.title;
  if (value === '') {
    label = 'Dashboards';
  }

  if (!visible) {
    return (
      <Button
        autoFocus={autoFocusButton}
        className={styles.button}
        variant="secondary"
        icon={value !== undefined ? 'folder' : undefined}
        ref={setTriggerRef}
      >
        {selectedFolder.isLoading ? (
          <Skeleton width={100} />
        ) : (
          <Text as="span" truncate>
            {label ?? <Trans i18nKey="browse-dashboards.folder-picker.button-label">Select folder</Trans>}
          </Text>
        )}
      </Button>
    );
  }

  return (
    <>
      <Input
        ref={setTriggerRef}
        autoFocus
        placeholder={label ?? t('browse-dashboards.folder-picker.search-placeholder', 'Search folders')}
        value={search}
        className={styles.search}
        onKeyDown={handleKeyDown}
        onChange={(e) => setSearch(e.currentTarget.value)}
        role="combobox"
        suffix={<Icon name="search" />}
      />
      <fieldset
        ref={setTooltipRef}
        {...getTooltipProps({
          className: styles.tableWrapper,
          style: {
            width: triggerRef?.clientWidth,
          },
        })}
      >
        {error ? (
          <Alert
            className={styles.error}
            severity="warning"
            title={t('browse-dashboards.folder-picker.error-title', 'Error loading folders')}
          >
            {error.message || error.toString?.() || t('browse-dashboards.folder-picker.unknown-error', 'Unknown error')}
          </Alert>
        ) : (
          <div>
            {isLoading && (
              <div className={styles.loader}>
                <LoadingBar width={600} />
              </div>
            )}

            <NestedFolderList
              items={tree}
              selectedFolder={value}
              focusedItemIndex={focusedItemIndex}
              onFolderExpand={handleFolderExpand}
              onFolderSelect={handleFolderSelect}
              foldersAreOpenable={!(search && searchState.value)}
            />
          </div>
        )}
      </fieldset>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      maxWidth: '100%',
    }),
    error: css({
      marginBottom: 0,
    }),
    tableWrapper: css({
      boxShadow: theme.shadows.z3,
      position: 'relative',
      zIndex: theme.zIndex.portal,
    }),
    loader: css({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: theme.zIndex.portal + 1,
      overflow: 'hidden', // loading bar overflows its container, so we need to clip it
    }),
    search: css({
      input: {
        cursor: 'default',
      },
    }),
  };
};

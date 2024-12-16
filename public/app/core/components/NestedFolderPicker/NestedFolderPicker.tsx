import { css } from '@emotion/css';
import { autoUpdate, flip, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import debounce from 'debounce-promise';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Icon, Input, LoadingBar, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { skipToken, useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { DashboardViewItemWithUIItems, DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { QueryResponse } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { PermissionLevelString } from 'app/types';

import { getDOMId, NestedFolderList } from './NestedFolderList';
import Trigger from './Trigger';
import { ROOT_FOLDER_ITEM, useFoldersQuery } from './useFoldersQuery';
import { useTreeInteractions } from './useTreeInteractions';

export interface NestedFolderPickerProps {
  /* Folder UID to show as selected */
  value?: string;

  /** Show an invalid state around the folder picker */
  invalid?: boolean;

  /* Whether to show the root 'Dashboards' (formally General) folder as selectable */
  showRootFolder?: boolean;

  /* Folder UIDs to exclude from the picker, to prevent invalid operations */
  excludeUIDs?: string[];

  /* Show folders matching this permission, mainly used to also show folders user can view. Defaults to showing only folders user has Edit  */
  permission?: PermissionLevelString.View | PermissionLevelString.Edit;

  /* Callback for when the user selects a folder */
  onChange?: (folderUID: string | undefined, folderName: string | undefined) => void;

  /* Whether the picker should be clearable */
  clearable?: boolean;
}

const debouncedSearch = debounce(getSearchResults, 300);

async function getSearchResults(searchQuery: string, permission?: PermissionLevelString) {
  const queryResponse = await getGrafanaSearcher().search({
    query: searchQuery,
    kind: ['folder'],
    limit: 100,
    permission: permission,
  });

  const items = queryResponse.view.map((v) => queryResultToViewItem(v, queryResponse.view));
  return { ...queryResponse, items };
}

export function NestedFolderPicker({
  value,
  invalid,
  showRootFolder = true,
  clearable = false,
  excludeUIDs,
  permission = PermissionLevelString.Edit,
  onChange,
}: NestedFolderPickerProps) {
  const styles = useStyles2(getStyles);
  const selectedFolder = useGetFolderQuery(value || skipToken);

  const nestedFoldersEnabled = Boolean(config.featureToggles.nestedFolders);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<(QueryResponse & { items: DashboardViewItem[] }) | null>(null);
  const [isFetchingSearchResults, setIsFetchingSearchResults] = useState(false);
  const [autoFocusButton, setAutoFocusButton] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [foldersOpenState, setFoldersOpenState] = useState<Record<string, boolean>>({});
  const overlayId = useId();
  const [error] = useState<Error | undefined>(undefined); // TODO: error not populated anymore
  const lastSearchTimestamp = useRef<number>(0);

  const isBrowsing = Boolean(overlayOpen && !(search && searchResults));
  const {
    items: browseFlatTree,
    isLoading: isBrowseLoading,
    requestNextPage: fetchFolderPage,
  } = useFoldersQuery(isBrowsing, foldersOpenState, permission);

  useEffect(() => {
    if (!search) {
      setSearchResults(null);
      return;
    }

    const timestamp = Date.now();
    setIsFetchingSearchResults(true);

    debouncedSearch(search, permission).then((queryResponse) => {
      // Only keep the results if it's was issued after the most recently resolved search.
      // This prevents results showing out of order if first request is slower than later ones.
      // We don't need to worry about clearing the isFetching state either - if there's a later
      // request in progress, this will clear it for us
      if (timestamp > lastSearchTimestamp.current) {
        const items = queryResponse.view.map((v) => queryResultToViewItem(v, queryResponse.view));
        setSearchResults({ ...queryResponse, items });
        setIsFetchingSearchResults(false);
        lastSearchTimestamp.current = timestamp;
      }
    });
  }, [search, permission]);

  // the order of middleware is important!
  const middleware = [
    flip({
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
  ];

  const { context, refs, floatingStyles, elements } = useFloating({
    open: overlayOpen,
    placement: 'bottom',
    onOpenChange: (value) => {
      // ensure state is clean on opening the overlay
      if (value) {
        setSearch('');
        setAutoFocusButton(true);
      }
      setOverlayOpen(value);
    },
    middleware,
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

  const handleFolderExpand = useCallback(
    async (uid: string, newOpenState: boolean) => {
      setFoldersOpenState((old) => ({ ...old, [uid]: newOpenState }));

      if (newOpenState && !foldersOpenState[uid]) {
        fetchFolderPage(uid);
      }
    },
    [fetchFolderPage, foldersOpenState]
  );

  const handleFolderSelect = useCallback(
    (item: DashboardViewItem) => {
      if (onChange) {
        onChange(item.uid, item.title);
      }
      setOverlayOpen(false);
    },
    [onChange]
  );

  const handleClearSelection = useCallback(
    (event: React.MouseEvent<SVGElement> | React.KeyboardEvent<SVGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (onChange) {
        onChange(undefined, undefined);
      }
    },
    [onChange]
  );

  const handleCloseOverlay = useCallback(() => setOverlayOpen(false), [setOverlayOpen]);

  const handleLoadMore = useCallback(
    (folderUID: string | undefined) => {
      if (search) {
        return;
      }

      fetchFolderPage(folderUID);
    },
    [search, fetchFolderPage]
  );

  const flatTree = useMemo(() => {
    let flatTree: Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> = [];

    if (isBrowsing) {
      flatTree = browseFlatTree;
    } else {
      flatTree =
        searchResults?.items.map((item) => ({
          isOpen: false,
          level: 0,
          item: {
            kind: 'folder' as const,
            title: item.title,
            uid: item.uid,
          },
        })) ?? [];
    }

    // It's not super optimal to filter these in an additional iteration, but
    // these options are used infrequently that its not a big deal
    if (!showRootFolder || excludeUIDs?.length) {
      flatTree = flatTree.filter((item) => {
        if (!showRootFolder && item === ROOT_FOLDER_ITEM) {
          return false;
        }

        if (excludeUIDs?.includes(item.item.uid)) {
          return false;
        }

        return true;
      });
    }

    return flatTree;
  }, [browseFlatTree, excludeUIDs, isBrowsing, searchResults?.items, showRootFolder]);

  const isItemLoaded = useCallback(
    (itemIndex: number) => {
      const treeItem = flatTree[itemIndex];
      if (!treeItem) {
        return false;
      }

      const item = treeItem.item;
      const result = !(item.kind === 'ui' && item.uiKind === 'pagination-placeholder');

      return result;
    },
    [flatTree]
  );

  const isLoading = isBrowseLoading || isFetchingSearchResults;

  const { focusedItemIndex, handleKeyDown } = useTreeInteractions({
    tree: flatTree,
    handleCloseOverlay,
    handleFolderSelect,
    handleFolderExpand,
    idPrefix: overlayId,
    search,
    visible: overlayOpen,
  });

  let label = selectedFolder.data?.title;
  if (value === '') {
    label = 'Dashboards';
  }

  if (!overlayOpen) {
    return (
      <Trigger
        label={label}
        handleClearSelection={clearable && value !== undefined ? handleClearSelection : undefined}
        invalid={invalid}
        isLoading={selectedFolder.isLoading}
        autoFocus={autoFocusButton}
        ref={refs.setReference}
        aria-label={
          label
            ? t('browse-dashboards.folder-picker.accessible-label', 'Select folder: {{ label }} currently selected', {
                label,
              })
            : undefined
        }
        {...getReferenceProps()}
      />
    );
  }

  return (
    <>
      <Input
        ref={refs.setReference}
        autoFocus
        prefix={label ? <Icon name="folder" /> : null}
        placeholder={label ?? t('browse-dashboards.folder-picker.search-placeholder', 'Search folders')}
        value={search}
        invalid={invalid}
        className={styles.search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        aria-autocomplete="list"
        aria-expanded
        aria-haspopup
        aria-controls={overlayId}
        aria-owns={overlayId}
        aria-activedescendant={getDOMId(overlayId, flatTree[focusedItemIndex]?.item.uid)}
        role="combobox"
        suffix={<Icon name="search" />}
        {...getReferenceProps()}
        onKeyDown={handleKeyDown}
      />
      <fieldset
        ref={refs.setFloating}
        id={overlayId}
        className={styles.tableWrapper}
        style={{
          ...floatingStyles,
          width: elements.domReference?.clientWidth,
        }}
        {...getFloatingProps()}
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
              items={flatTree}
              selectedFolder={value}
              focusedItemIndex={focusedItemIndex}
              onFolderExpand={handleFolderExpand}
              onFolderSelect={handleFolderSelect}
              idPrefix={overlayId}
              foldersAreOpenable={nestedFoldersEnabled && !(search && searchResults)}
              isItemLoaded={isItemLoaded}
              requestLoadMore={handleLoadMore}
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

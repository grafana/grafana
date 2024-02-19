import { css } from '@emotion/css';
import { autoUpdate, flip, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { createSelector } from '@reduxjs/toolkit';
import { QueryDefinition, BaseQueryFn } from '@reduxjs/toolkit/dist/query';
import { QueryActionCreatorResult } from '@reduxjs/toolkit/dist/query/core/buildInitiate';
import debounce from 'debounce-promise';
import { RequestOptions } from 'http';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Icon, Input, LoadingBar, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import {
  ListFolderArgs,
  browseDashboardsAPI,
  skipToken,
  useGetFolderQuery,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { useBrowseLoadingStatus } from 'app/features/browse-dashboards/state';
import { getPaginationPlaceholders } from 'app/features/browse-dashboards/state/utils';
import { DashboardViewItemWithUIItems, DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { QueryResponse, getGrafanaSearcher } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { RootState } from 'app/store/configureStore';
import { FolderDTO } from 'app/types';
import { useDispatch, useSelector } from 'app/types/store';

import { getDOMId, NestedFolderList } from './NestedFolderList';
import Trigger from './Trigger';
import { useTreeInteractions } from './hooks';

export interface NestedFolderPickerProps {
  /* Folder UID to show as selected */
  value?: string;

  /** Show an invalid state around the folder picker */
  invalid?: boolean;

  /* Whether to show the root 'Dashboards' (formally General) folder as selectable */
  showRootFolder?: boolean;

  /* Folder UIDs to exclude from the picker, to prevent invalid operations */
  excludeUIDs?: string[];

  /* Callback for when the user selects a folder */
  onChange?: (folderUID: string | undefined, folderName: string | undefined) => void;

  /* Whether the picker should be clearable */
  clearable?: boolean;
}

const debouncedSearch = debounce(getSearchResults, 300);

async function getSearchResults(searchQuery: string) {
  const queryResponse = await getGrafanaSearcher().search({
    query: searchQuery,
    kind: ['folder'],
    limit: 100,
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
  onChange,
}: NestedFolderPickerProps) {
  const styles = useStyles2(getStyles);
  const selectedFolder = useGetFolderQuery(value || skipToken);

  const rootStatus = useBrowseLoadingStatus(undefined);
  const nestedFoldersEnabled = Boolean(config.featureToggles.nestedFolders);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<(QueryResponse & { items: DashboardViewItem[] }) | null>(null);
  const [isFetchingSearchResults, setIsFetchingSearchResults] = useState(false);
  const [autoFocusButton, setAutoFocusButton] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>({});
  const overlayId = useId();
  const [error] = useState<Error | undefined>(undefined); // TODO: error not populated anymore
  const lastSearchTimestamp = useRef<number>(0);

  const [flatTree, fetchFolderPage] = useFolderList(folderOpenState);

  useEffect(() => {
    if (!search) {
      setSearchResults(null);
      return;
    }
    const timestamp = Date.now();
    setIsFetchingSearchResults(true);
    debouncedSearch(search).then((queryResponse) => {
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
  }, [search]);

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
      setFolderOpenState((old) => ({ ...old, [uid]: newOpenState }));

      if (newOpenState && !folderOpenState[uid]) {
        fetchFolderPage(uid);
      }
    },
    [fetchFolderPage, folderOpenState]
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

  // JOSH TODO: return search results as a flat tree

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

  const isLoading = rootStatus === 'pending' || isFetchingSearchResults;

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

type TODOFolderListPage = ReturnType<typeof listFoldersSelector>;
type TODORequestPromise = QueryActionCreatorResult<
  QueryDefinition<ListFolderArgs, BaseQueryFn<RequestOptions>, 'getFolder', FolderDTO[], 'browseDashboardsAPI'>
>;

const createListFoldersSelector = createSelector(
  [
    (parentUid: ListFolderArgs['parentUid']) => parentUid,
    (parentUid: ListFolderArgs['parentUid'], page: ListFolderArgs['page']) => page,
    (parentUid: ListFolderArgs['parentUid'], page: ListFolderArgs['page'], limit: ListFolderArgs['limit']) => limit,
  ],
  (parentUid, page, limit) => {
    return browseDashboardsAPI.endpoints.listFolders.select({ parentUid, page, limit });
  }
);

const listFoldersSelector = createSelector(
  (state: RootState) => state,
  (
    state: RootState,
    parentUid: ListFolderArgs['parentUid'],
    page: ListFolderArgs['page'],
    limit: ListFolderArgs['limit']
  ) => createListFoldersSelector(parentUid, page, limit),
  (state, selectFolderList) => selectFolderList(state)
);

const listAllFoldersSelector = createSelector(
  [(state: RootState) => state, (state: RootState, requests: TODORequestPromise[]) => requests],
  (state: RootState, requests: TODORequestPromise[]) => {
    const seenRequests = new Set<string>();

    const rootPages: TODOFolderListPage[] = [];
    const pagesByParent: Record<string, TODOFolderListPage[]> = {};

    for (const req of requests) {
      if (seenRequests.has(req.requestId)) {
        continue;
      }

      const page = listFoldersSelector(state, req.arg.parentUid, req.arg.page, req.arg.limit);

      const parentUid = page.originalArgs?.parentUid;
      if (parentUid) {
        if (!pagesByParent[parentUid]) {
          pagesByParent[parentUid] = [];
        }

        pagesByParent[parentUid].push(page);
      } else {
        rootPages.push(page);
      }
    }

    return {
      rootPages,
      pagesByParent,
    };
  }
);

/**
 * Returns the whether the set of pages are 'fully loaded', and the last page number
 */
function getPagesLoadStatus(pages: TODOFolderListPage[]): [boolean, number] {
  const lastPage = pages.at(-1);
  const fullyLoaded = lastPage && (lastPage.data?.length ?? 0) < (lastPage.originalArgs?.limit ?? 0);

  return [Boolean(fullyLoaded), lastPage?.originalArgs?.page ?? 1];
}

/**
 * Returns a loaded folder hierarchy as a flat list and a function to load more pages.
 */
function useFolderList(openFolders: Record<string, boolean>) {
  const dispatch = useDispatch();

  // Keep a list of all requests so we can
  //   a) unsubscribe from them when the component is unmounted
  //   b) use them to select the responses out of the state
  const requestsRef = useRef<TODORequestPromise[]>([]);

  const state = useSelector((rootState: RootState) => {
    return listAllFoldersSelector(rootState, requestsRef.current);
  });

  // Loads the next page of folders for the given parent UID by inspecting the
  // state to determine what the next page is
  const requestNextPage = useCallback(
    (parentUid: string | undefined) => {
      const pages = parentUid ? state.pagesByParent[parentUid] : state.rootPages;
      const [fullyLoaded, pageNumber] = getPagesLoadStatus(pages);
      if (fullyLoaded) {
        return;
      }

      const args = { parentUid, page: pageNumber + 1, limit: PAGE_SIZE };
      const promise = dispatch(browseDashboardsAPI.endpoints.listFolders.initiate(args));

      // It's important that we create a new array so we can correctly memoize with it
      requestsRef.current = requestsRef.current.concat([promise]);
    },
    [state, dispatch]
  );

  // Unsubscribe from all requests when the component is unmounted
  useEffect(() => {
    return () => {
      for (const req of requestsRef.current) {
        req.unsubscribe();
      }
    };
  }, []);

  // Convert the individual responses into a flat list of folders, with level indicating
  // the depth in the hierarchy.
  // TODO: this will probably go up in the parent component so it can also do search
  const treeList = useMemo(() => {
    function createFlatList(
      parentUid: string | undefined,
      pages: TODOFolderListPage[],
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> {
      const flatList = pages.flatMap((page) => {
        const pageItems = page.data ?? [];

        return pageItems.flatMap((item) => {
          const folderIsOpen = openFolders[item.uid];

          const flatItem: DashboardsTreeItem<DashboardViewItemWithUIItems> = {
            isOpen: Boolean(folderIsOpen),
            level: level,
            item: {
              kind: 'folder' as const,
              title: item.title,
              uid: item.uid,
            },
          };

          const childPages = folderIsOpen && state.pagesByParent[item.uid];
          if (childPages) {
            const childFlatItems = createFlatList(item.uid, childPages, level + 1);
            return [flatItem, ...childFlatItems];
          }

          return flatItem;
        });
      });

      const [fullyLoaded] = getPagesLoadStatus(pages);
      if (!fullyLoaded) {
        flatList.push(...getPaginationPlaceholders(PAGE_SIZE, parentUid, level));
      }

      return flatList;
    }

    const rootFlatTree = createFlatList(undefined, state.rootPages, 1);
    rootFlatTree.unshift(ROOT_FOLDER_ITEM);

    return rootFlatTree;
  }, [state, openFolders]);

  return [treeList, requestNextPage] as const;
}

const ROOT_FOLDER_ITEM = {
  isOpen: true,
  level: 0,
  item: {
    kind: 'folder' as const,
    title: 'Dashboards',
    uid: '',
  },
};

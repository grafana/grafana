import { css } from '@emotion/css';
import { autoUpdate, flip, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { createSelector } from '@reduxjs/toolkit';
import debounce from 'debounce-promise';
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
  useLazyListFoldersQuery,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import {
  childrenByParentUIDSelector,
  createFlatTree,
  rootItemsSelector,
  useBrowseLoadingStatus,
} from 'app/features/browse-dashboards/state';
import { getPaginationPlaceholders } from 'app/features/browse-dashboards/state/utils';
import {
  DashboardViewItemCollection,
  DashboardViewItemWithUIItems,
  DashboardsTreeItem,
} from 'app/features/browse-dashboards/types';
import { QueryResponse, getGrafanaSearcher } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
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

const EXCLUDED_KINDS = ['empty-folder' as const, 'dashboard' as const];

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

  const [flatTree, fetchFolderPage] = useFolderList();

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

  // const rootCollection = useSelector(rootItemsSelector);
  // const childrenCollections = useSelector(childrenByParentUIDSelector);

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
        console.log('TODO: fetch next children page here', { parentUID: uid, pageSize: PAGE_SIZE });
        // dispatch(fetchNextChildrenPage({ parentUID: uid, pageSize: PAGE_SIZE, excludeKinds: EXCLUDED_KINDS }));
      }
    },
    [folderOpenState]
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

  // const baseHandleLoadMore = useLoadNextChildrenPage(EXCLUDED_KINDS);
  const handleLoadMore = useCallback(
    (folderUID: string | undefined) => {
      if (search) {
        return;
      }

      fetchFolderPage(folderUID);
    },
    [search, fetchFolderPage]
  );

  // const flatTree = useMemo(() => {
  //   if (search && searchResults) {
  //     const searchCollection: DashboardViewItemCollection = {
  //       isFullyLoaded: true, //searchResults.items.length === searchResults.totalRows,
  //       lastKindHasMoreItems: false, // TODO: paginate search
  //       lastFetchedKind: 'folder', // TODO: paginate search
  //       lastFetchedPage: 1, // TODO: paginate search
  //       items: searchResults.items ?? [],
  //     };

  //     return createFlatTree(undefined, searchCollection, childrenCollections, {}, 0, EXCLUDED_KINDS, excludeUIDs);
  //   }

  //   const allExcludedUIDs = config.sharedWithMeFolderUID
  //     ? [...(excludeUIDs || []), config.sharedWithMeFolderUID]
  //     : excludeUIDs;

  //   let flatTree = createFlatTree(
  //     undefined,
  //     rootCollection,
  //     childrenCollections,
  //     folderOpenState,
  //     0,
  //     EXCLUDED_KINDS,
  //     allExcludedUIDs
  //   );

  //   if (showRootFolder) {
  //     // Increase the level of each item to 'make way' for the fake root Dashboards item
  //     for (const item of flatTree) {
  //       item.level += 1;
  //     }

  //     flatTree.unshift({
  //       isOpen: true,
  //       level: 0,
  //       item: {
  //         kind: 'folder',
  //         title: 'Dashboards',
  //         uid: '',
  //       },
  //     });
  //   }

  //   // If the root collection hasn't loaded yet, create loading placeholders
  //   if (!rootCollection) {
  //     flatTree = flatTree.concat(getPaginationPlaceholders(PAGE_SIZE, undefined, 0));
  //   }

  //   return flatTree;
  // }, [search, searchResults, rootCollection, childrenCollections, folderOpenState, excludeUIDs, showRootFolder]);

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

// const listFoldersSelector = createSelector(
//   (parentUid: string | undefined, page: number) => ({ parentUid, page }),
//   (args) => browseDashboardsAPI.endpoints.listFolders.select(args)
// );

// export type DashboardViewItemCollection = {
//   items: DashboardViewItem[];
//   lastFetchedKind: 'folder' | 'dashboard';
//   lastFetchedPage: number;
//   lastKindHasMoreItems: boolean;
//   isFullyLoaded: boolean;
// };

const listFolderSelector = createSelector(
  [
    (state: any) => state,
    (state, parentUid: ListFolderArgs['parentUid']) => parentUid,
    (state, parentUid: ListFolderArgs['parentUid'], page: ListFolderArgs['page']) => page,
    (state, parentUid: ListFolderArgs['parentUid'], page: ListFolderArgs['page'], limit: ListFolderArgs['limit']) =>
      limit,
  ],
  (state, parentUid, page, limit) => {
    return browseDashboardsAPI.endpoints.listFolders.select({ parentUid, page, limit })(state);
  }
);

function useFolderList() {
  const requestedArgs = useRef<ListFolderArgs[] | null>(null);
  if (requestedArgs.current === null) {
    requestedArgs.current = [];
  }

  // TODO: propertly memoize this into a stable selector
  const state = useSelector((rxState) => {
    const requests = requestedArgs.current ?? [];

    const pages = requests
      .map((args) => {
        return listFolderSelector(rxState, args.parentUid, args.page, args.limit);
      })
      .filter((page, index, all) => {
        return all.findIndex((otherPage) => otherPage.requestId === page.requestId) === index;
      });

    const rootPages: Array<(typeof pages)[number]> = [];
    const pagesByParent: Record<string, Array<(typeof pages)[number]>> = {};

    for (const page of pages) {
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
  });

  console.log('state', state);

  const rootCollection = useMemo(() => {
    const rrr = state.rootPages;

    let flatTree: Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> = rrr.flatMap((page) => {
      return (page.data ?? []).map((item) => {
        const ddddd: DashboardsTreeItem<DashboardViewItemWithUIItems> = {
          isOpen: false,
          level: 1,
          item: {
            kind: 'folder' as const,
            title: item.title,
            uid: item.uid,
          },
        };

        return ddddd;
      });
    });

    flatTree.unshift({
      isOpen: true,
      level: 0,
      item: {
        kind: 'folder',
        title: 'Dashboards',
        uid: '',
      },
    });

    const lastPage = rrr.at(-1);
    const fullyLoaded = (lastPage?.data?.length ?? 0) < (lastPage?.originalArgs?.limit ?? 0);

    if (!fullyLoaded) {
      flatTree = flatTree.concat(getPaginationPlaceholders(PAGE_SIZE, undefined, 1));
    }

    return flatTree;
  }, [state]);

  const dispatch = useDispatch();
  const unsubscribes = useRef<Function[] | null>();

  if (!unsubscribes.current) {
    unsubscribes.current = [];
  }

  const loadNextPage = useCallback(
    (parentUid: string | undefined) => {
      console.log('loadNextPage', { parentUid });

      const pageSet = parentUid ? state.pagesByParent[parentUid] : state.rootPages;

      let page = 1;
      if (pageSet) {
        page = pageSet.length + 1;
      }

      const args = { parentUid, page, limit: PAGE_SIZE };
      requestedArgs.current?.push(args);
      // Actually make the api call
      const promise = dispatch(browseDashboardsAPI.endpoints.listFolders.initiate(args));

      console.log('promise-ish', promise);

      unsubscribes.current?.push(promise.unsubscribe);
    },
    [state, dispatch]
  );

  useEffect(() => {
    return () => {
      for (const unsubscribe of unsubscribes.current ?? []) {
        unsubscribe();
      }
    };
  }, []);

  return [rootCollection, loadNextPage] as const;
}

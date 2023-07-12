import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { usePopperTooltip } from 'react-popper-tooltip';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Icon, Input, LoadingBar, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Trans, t } from 'app/core/internationalization';
import { skipToken, useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import {
  childrenByParentUIDSelector,
  createFlatTree,
  fetchNextChildrenPage,
  rootItemsSelector,
  useBrowseLoadingStatus,
  useLoadNextChildrenPage,
} from 'app/features/browse-dashboards/state';
import { getPaginationPlaceholders } from 'app/features/browse-dashboards/state/utils';
import { DashboardViewItemCollection } from 'app/features/browse-dashboards/types';
import { getGrafanaSearcher } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { useDispatch, useSelector } from 'app/types/store';

import { NestedFolderList } from './NestedFolderList';
import { FolderChange, FolderUID } from './types';

interface NestedFolderPickerProps {
  value?: FolderUID;
  // TODO: think properly (and pragmatically) about how to communicate moving to general folder,
  // vs removing selection (if possible?)
  onChange?: (folder: FolderChange) => void;
}

export function NestedFolderPicker({ value, onChange }: NestedFolderPickerProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const selectedFolder = useGetFolderQuery(value || skipToken);

  const rootStatus = useBrowseLoadingStatus(undefined);

  const [search, setSearch] = useState('');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>({});
  const [error] = useState<Error | undefined>(undefined); // TODO: error not populated anymore

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

  const handleFolderClick = useCallback(
    async (uid: string, newOpenState: boolean) => {
      setFolderOpenState((old) => ({ ...old, [uid]: newOpenState }));

      if (newOpenState) {
        dispatch(fetchNextChildrenPage({ parentUID: uid, pageSize: PAGE_SIZE, loadDashboards: false }));
      }
    },
    [dispatch]
  );

  const rootCollection = useSelector(rootItemsSelector);
  const childrenCollections = useSelector(childrenByParentUIDSelector);

  const handleSelectionChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>, item: DashboardViewItem) => {
      if (onChange) {
        onChange({
          uid: item.uid,
          title: item.title,
        });
      }
      setOverlayOpen(false);
    },
    [onChange]
  );

  const { getTooltipProps, setTooltipRef, setTriggerRef, visible, triggerRef } = usePopperTooltip({
    visible: overlayOpen,
    placement: 'bottom',
    interactive: true,
    offset: [0, 0],
    trigger: 'click',
    onVisibleChange: (value: boolean) => {
      // ensure search state is clean on opening the overlay
      if (value) {
        setSearch('');
      }
      setOverlayOpen(value);
    },
  });

  const baseHandleLoadMore = useLoadNextChildrenPage(false);
  const handleLoadMore = useCallback(
    (folderUID: string | undefined) => {
      if (search) {
        return;
      }

      baseHandleLoadMore(folderUID);
    },
    [search, baseHandleLoadMore]
  );

  const flatTree = useMemo(() => {
    const searchResults = search && searchState.value;

    if (searchResults) {
      const searchCollection: DashboardViewItemCollection = {
        isFullyLoaded: true, //searchResults.items.length === searchResults.totalRows,
        lastKindHasMoreItems: false, // TODO: paginate search
        lastFetchedKind: 'folder', // TODO: paginate search
        lastFetchedPage: 1, // TODO: paginate search
        items: searchResults.items ?? [],
      };

      const flatTree = createFlatTree(
        undefined, // so far folder picker doesn't have a "folder view", so the top-level is always undefined
        searchCollection,
        childrenCollections,
        {},
        0,
        false
      );

      return flatTree;
    }

    let flatTree = createFlatTree(
      undefined, // so far folder picker doesn't have a "folder view", so the top-level is always undefined
      rootCollection,
      childrenCollections,
      searchResults ? {} : folderOpenState,
      0,
      false
    );

    // Mutate the items to increase each level to make way for the root Dashboards item
    // We don't set the initial level in createFlatTree to 1 because that currently mucks up
    // pagination placeholder logic
    for (const item of flatTree) {
      item.level += 1;
    }

    flatTree.unshift({
      isOpen: true,
      level: 0,
      item: {
        kind: 'folder',
        title: 'Dashboards',
        uid: '',
      },
    });

    // If the root collection hasn't loaded yet, create loading placeholders
    if (!rootCollection) {
      flatTree = flatTree.concat(getPaginationPlaceholders(PAGE_SIZE, undefined, 0));
    }

    return flatTree;
  }, [search, searchState.value, rootCollection, childrenCollections, folderOpenState]);

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

  const isLoading = rootStatus === 'pending' || searchState.loading;

  let label = selectedFolder.data?.title;
  if (value === '') {
    label = 'Dashboards';
  }

  if (!visible) {
    return (
      <Button
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
              items={flatTree}
              selectedFolder={value}
              onFolderClick={handleFolderClick}
              onSelectionChange={handleSelectionChange}
              foldersAreOpenable={!(search && searchState.value)}
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

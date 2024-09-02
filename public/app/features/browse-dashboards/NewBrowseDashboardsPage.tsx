/* eslint-disable @grafana/no-untranslated-strings */
import { useWindowVirtualizer, Virtualizer, VirtualItem } from '@tanstack/react-virtual';
import { ReactNode, useCallback, useEffect, useReducer, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Text, Stack, Icon, IconButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useNewBrowseDashboardsLoader } from './new-api/useNewBrowseDashboardsLoader';
import { NewBrowseItem, OpenFolders } from './newTypes';

interface NewBrowseDashboardsPageProps {}

function folderStateReducer(state: OpenFolders, action: { isOpen: boolean; uid: string }) {
  return {
    ...state,
    [action.uid]: action.isOpen,
  };
}

/**
 * This is a new new version of BrowseDashboards, gated behind the newNewBrowseDashboards feature toggle.
 *
 * Improvements:
 * - It uses a window virtualizer, with body scrolling, to virtualise the list. This reduces the 'scrolling a box'
 *    effect that the old implementation had, gives it more space, and allows for things like sticky UI.
 * - All API requests are managed entirely within RTK Query, with a custom generic hook that handles multiple queries.
 *   This removes a lot of complexity that we previously had in redux actions and reducers, and allows for better caching.
 */

export default function NewBrowseDashboardsPage(props: NewBrowseDashboardsPageProps) {
  const [openFolders, setOpenFolders] = useReducer(folderStateReducer, {});

  const rootFolderUID = undefined; // TODO: this would be the UID of the folder for folder view
  const { items: allRows, isLoading, requestNextPage } = useNewBrowseDashboardsLoader(rootFolderUID, openFolders);

  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: allRows.length,
    estimateSize: () => 35,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // This hook is responsible for loading all items when a 'loading-placeholder' is rendered
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const firstUnloaded = virtualItems.find((item) => {
      const browseItem = allRows[item.index];
      return browseItem.type === 'loading-placeholder';
    });

    if (firstUnloaded) {
      const browseItem = allRows[firstUnloaded.index];
      requestNextPage(browseItem.parentUid);
    }
  }, [isLoading, virtualItems, requestNextPage, allRows]);

  const handleFolderButtonClick = useCallback((item: NewBrowseItem, isOpen: boolean) => {
    console.log('%c----- handleFolderButtonClick -----', 'color: yellow');
    // When a folder is opened, we don't immediately load its contents.
    // Instead, it's marked as open and the API hook will render placeholder items inside it.
    // The data loader hook will then see those and trigger the loading of the folder's contents.
    setOpenFolders({ isOpen, uid: item.uid });
  }, []);

  return (
    <Page navId="dashboards/browse">
      <div ref={listRef} className="List">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((item) => {
            const browseItem = allRows.at(item.index); // used to make the return type | undefined
            const isOpen = openFolders[browseItem?.uid ?? ''] ?? false;

            if (!browseItem) {
              return (
                <VirtualRow level={0} key={item.key} virtualItem={item} virtualizer={virtualizer}>
                  Missing browse item (should not happen)
                </VirtualRow>
              );
            }

            if (browseItem.type === 'loading-placeholder') {
              return (
                <VirtualRow level={browseItem.level} key={item.key} virtualItem={item} virtualizer={virtualizer}>
                  <Skeleton width={300} />
                </VirtualRow>
              );
            }

            return (
              <VirtualRow level={browseItem.level} key={item.key} virtualItem={item} virtualizer={virtualizer}>
                <Stack gap={3} alignItems={'center'}>
                  {browseItem.type === 'dashboard' ? (
                    <Icon name="dashboard" />
                  ) : (
                    <IconButton
                      onClick={() => browseItem && handleFolderButtonClick(browseItem, !isOpen)}
                      tooltip={isOpen ? 'Close' : 'Open'}
                      name={isOpen ? 'folder-open' : 'folder'}
                    />
                  )}
                  <Text tabular>Row {item.index}</Text>
                  <Text tabular>
                    {browseItem.type === 'folder' ? (browseItem.item.title ?? 'no folder title') : browseItem.title}
                  </Text>
                  <Text tabular>{browseItem.uid}</Text>
                </Stack>
              </VirtualRow>
            );
          })}
        </div>
      </div>
    </Page>
  );
}

interface VirtualRowProps {
  virtualItem: VirtualItem<Element>;
  virtualizer: Virtualizer<Window, Element>;
  children: ReactNode;
  level: number;
}

function VirtualRow({ level, virtualItem, virtualizer, children }: VirtualRowProps) {
  return (
    <div
      key={virtualItem.key}
      className={virtualItem.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
      style={{
        position: 'absolute',
        top: 0,
        // left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
        left: level * 32,
      }}
    >
      {children}
    </div>
  );
}

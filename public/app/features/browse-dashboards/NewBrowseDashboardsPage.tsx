/* eslint-disable no-console */
import { useWindowVirtualizer, Virtualizer, VirtualItem } from '@tanstack/react-virtual';
import { ReactNode, useCallback, useEffect, useReducer, useRef } from 'react';

import { Text, Stack, Icon, IconButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useNewAPIBlahBlah } from './new-api/useBlahBlah';
import { NewBrowseItem, OpenFolders } from './newTypes';

interface NewBrowseDashboardsPageProps {}

function folderStateReducer(state: OpenFolders, action: { isOpen: boolean; uid: string }) {
  return {
    ...state,
    [action.uid]: action.isOpen,
  };
}

export default function NewBrowseDashboardsPage(props: NewBrowseDashboardsPageProps) {
  const [openFolders, setOpenFolders] = useReducer(folderStateReducer, {});

  /*
    TODO: here's how we load stuff properly:
     - Give openFolders to the API hook. ✔️
     - API hook should return placeholder items for incomplete folders (including root)
     - The item loader hook should:
       - Find the first placeholder in the virtual items
       - Check it's parentUID (which folder it belongs to)
       - Give that parentUID to requestNextPage to load more of that folder
  */

  const { items: allRows, isLoading, hasNextPage, requestNextPage } = useNewAPIBlahBlah(openFolders);

  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: allRows.length,
    estimateSize: () => 35,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // item loader hook
  useEffect(() => {
    if (!hasNextPage || isLoading) {
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
  }, [isLoading, hasNextPage, virtualItems, requestNextPage, allRows]);

  const handleFolderButtonClick = useCallback((item: NewBrowseItem, isOpen: boolean) => {
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
            const browseItem = allRows[item.index] as NewBrowseItem | undefined;
            const isOpen = openFolders[browseItem?.uid ?? ''] ?? false;

            if (!browseItem) {
              return (
                <VirtualRow key={item.key} virtualItem={item} virtualizer={virtualizer}>
                  Missing browse item (should not happen)
                </VirtualRow>
              );
            }

            if (browseItem.type === 'loading-placeholder') {
              return (
                <VirtualRow key={item.key} virtualItem={item} virtualizer={virtualizer}>
                  Loading placeholder...
                </VirtualRow>
              );
            }

            return (
              <VirtualRow key={item.key} virtualItem={item} virtualizer={virtualizer}>
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
                  <Text tabular>{browseItem.title}</Text>
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
}

function VirtualRow({ virtualItem, virtualizer, children }: VirtualRowProps) {
  return (
    <div
      key={virtualItem.key}
      className={virtualItem.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
      }}
    >
      {children}
    </div>
  );
}

/* eslint-disable no-console */
import { useWindowVirtualizer, Virtualizer, VirtualItem } from '@tanstack/react-virtual';
import { ReactNode, useCallback, useEffect, useReducer, useRef } from 'react';

import { Text, Stack, Icon, IconButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { NewBrowseItem, useNewAPIBlahBlah } from './new-api/useBlahBlah';

interface NewBrowseDashboardsPageProps {}

function folderStateReducer(state: Record<string, boolean>, action: { isOpen: boolean; uid: string }) {
  return {
    ...state,
    [action.uid]: action.isOpen,
  };
}

export default function NewBrowseDashboardsPage(props: NewBrowseDashboardsPageProps) {
  const [openFolders, setOpenFolders] = useReducer(folderStateReducer, {});

  /*
    TODO: here's how we load stuff properly:
     - Give openFolders to the API hook.
     - API hook should return placeholder items for incomplete folders (including root)
     - The item loader hook should:
       - Find the first placeholder in the virtual items
       - Check it's parentUID (which folder it belongs to)
       - Give that parentUID to requestNextPage to load more of that folder
  */

  const { items: allRows, isLoading, hasNextPage, requestNextPage } = useNewAPIBlahBlah();

  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allRows.length + 1 : allRows.length,
    estimateSize: () => 35,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // item loader hook
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (lastItem.index >= allRows.length - 1 && hasNextPage && !isLoading) {
      // Should pass in the root folder UID (undefined on root page)
      requestNextPage();
    }
  }, [isLoading, hasNextPage, allRows.length, virtualItems, requestNextPage]);

  const handleFolderButtonClick = useCallback((item: NewBrowseItem, isOpen: boolean) => {
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
                  Fake loading row...
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

/* eslint-disable no-console */
import { useWindowVirtualizer, Virtualizer, VirtualItem } from '@tanstack/react-virtual';
import { ReactNode, useEffect, useRef } from 'react';

import { Page } from 'app/core/components/Page/Page';

import { NewBrowseItem, useNewAPIBlahBlah } from './new-api/useBlahBlah';

interface NewBrowseDashboardsPageProps {}

export default function NewBrowseDashboardsPage(props: NewBrowseDashboardsPageProps) {
  const { items: allRows, isLoading, hasNextPage, requestNextPage } = useNewAPIBlahBlah();

  const listRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allRows.length + 1 : allRows.length,
    estimateSize: () => 35,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (lastItem.index >= allRows.length - 1 && hasNextPage && !isLoading) {
      requestNextPage();
    }
  }, [isLoading, hasNextPage, allRows.length, virtualItems, requestNextPage]);

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

            if (!browseItem) {
              return (
                <VirtualRow key={item.key} virtualItem={item} virtualizer={virtualizer}>
                  Fake loading row...
                </VirtualRow>
              );
            }

            return (
              <VirtualRow key={item.key} virtualItem={item} virtualizer={virtualizer}>
                Row {item.index} / {browseItem.type} / {browseItem.title}
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

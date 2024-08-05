import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Page } from 'app/core/components/Page/Page';

interface NewBrowseDashboardsPageProps {}

interface APIItem {
  id: string;
  title: string;
}

const PAGE_SIZE = 50;
const LOAD_TIME = 2 * 1000;

interface PretendAPI {
  isLoading: boolean;
  pages: APIItem[][];
}

export default function NewBrowseDashboardsPage(props: NewBrowseDashboardsPageProps) {
  const { fetchNextPage, isLoading, pages } = useAPI();

  const hasNextPage = pages.length < 5;
  const allRows = pages.flat();

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
      fetchNextPage();
    }
  }, [isLoading, hasNextPage, fetchNextPage, allRows.length, virtualItems]);

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
          {virtualItems.map((item) => (
            <div
              key={item.key}
              className={item.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              Row {item.index}
            </div>
          ))}
        </div>
      </div>

      <div>{isLoading ? 'Loading...' : null}</div>
    </Page>
  );
}

function useAPI() {
  const [{ isLoading, pages }, setState] = useState<PretendAPI>({
    isLoading: false,
    pages: [],
  });

  const fetchNextPage = useCallback(() => {
    setState((currentState) => ({ ...currentState, isLoading: true }));

    setTimeout(() => {
      setState((currentState) => {
        const nextPageNumber = currentState.pages.length + 1;

        const nextPage = new Array(PAGE_SIZE).fill(null).map((_, index) => ({
          id: `item-${nextPageNumber}-${index}`,
          title: `Item ${nextPageNumber}-${index}`,
        }));

        const newPages = [...currentState.pages, nextPage];

        return {
          isLoading: false,
          pages: newPages,
        };
      });
    }, LOAD_TIME);
  }, []);

  return {
    isLoading,
    pages,
    fetchNextPage,
  };
}

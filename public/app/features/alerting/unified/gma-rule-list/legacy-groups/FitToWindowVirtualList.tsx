import { css } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';

import { useStyles2 } from '@grafana/ui';

const ROW_ESTIMATE_HEIGHT = 48;
const OVERSCAN = 10;
const MIN_HEIGHT = 300;

interface FitToWindowVirtualListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Called while the last item is in view; undefined when there is nothing more to load. */
  onEndReached?: () => void;
  footer?: ReactNode;
  'aria-label': string;
}

/** A virtualised list that fills the rest of the window and scrolls itself; items may differ in height. */
export function FitToWindowVirtualList<T>({
  items,
  getKey,
  renderItem,
  onEndReached,
  footer,
  'aria-label': ariaLabel,
}: FitToWindowVirtualListProps<T>) {
  const styles = useStyles2(getStyles);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const attachScrollArea = useFitToWindow(scrollRef);

  const virtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => (items[index] ? getKey(items[index]) : index),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_HEIGHT,
    measureElement: (element) => element.getBoundingClientRect().height || ROW_ESTIMATE_HEIGHT,
    overscan: OVERSCAN,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const endInView = (virtualItems.at(-1)?.index ?? -1) >= items.length - 1;

  // Re-runs once onEndReached is set again, so an end still in view loads the next page.
  useEffect(() => {
    if (endInView && onEndReached) {
      onEndReached();
    }
  }, [endInView, onEndReached]);

  return (
    <div ref={attachScrollArea} className={styles.scroll}>
      <ul className={styles.list} style={{ height: virtualizer.getTotalSize() }} aria-label={ariaLabel}>
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <li
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className={styles.item}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {item !== undefined && renderItem(item)}
            </li>
          );
        })}
      </ul>
      {footer}
    </div>
  );
}

/** Sizes the element to the rest of the window. Stable, so it isn't re-attached on every scroll render. */
function useFitToWindow(elementRef: { current: HTMLDivElement | null }) {
  return useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      if (!element) {
        return;
      }
      const fit = () => {
        const fitHeight = (height: number) => (element.style.height = `${Math.max(MIN_HEIGHT, height)}px`);
        fitHeight(window.innerHeight - element.getBoundingClientRect().top);
        // What still overflows is the page's own spacing below the list (the window's, or the card's when docked).
        // shortcut: relies on Page's data-page-card attribute; use a Page API instead if one exposes its scroll container.
        const page = document.scrollingElement;
        const card = element.closest<HTMLElement>('[data-page-card]');
        const overflow = Math.max(
          page ? page.scrollHeight - page.clientHeight : 0,
          card ? card.scrollHeight - card.clientHeight : 0
        );
        fitHeight(element.clientHeight - overflow);
      };
      fit();
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    },
    [elementRef]
  );
}

const getStyles = () => ({
  scroll: css({
    overflowY: 'auto',
  }),
  list: css({
    listStyle: 'none',
    position: 'relative',
    margin: 0,
    padding: 0,
  }),
  item: css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  }),
});

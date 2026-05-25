import { type RefObject, useCallback, useRef } from 'react';

import { type StackedEditorItem } from '../QueryEditorContext';

import { useActiveStackedItemObserver } from './useActiveStackedItemObserver';
import { getStackedItemKey, getStackedItemsKey, type StackedItem } from './utils';

interface UseStackedItemScrollArgs {
  containerRef: RefObject<HTMLDivElement>;
  items: readonly StackedItem[];
  onActiveItemChange: (item: StackedEditorItem) => void;
  setScrollHandler: (handler: ((item: StackedEditorItem) => void) | null) => void;
}

function findSection(container: HTMLElement, item: StackedEditorItem): HTMLElement | null {
  const sections = container.querySelectorAll<HTMLElement>('[data-stacked-editor-item-id]');
  for (const section of sections) {
    if (section.dataset.stackedEditorItemId === item.id && section.dataset.stackedEditorItemType === item.type) {
      return section;
    }
  }
  return null;
}

/**
 * Wires the stacked editor into the wrapper's scroll bridge and the active-item observer.
 *
 * - Pushes an imperative `scrollToItem` to the wrapper via `setScrollHandler` so sidebar clicks
 *   can scroll a section into view without state or effects.
 * - Mounts the IntersectionObserver that calls `onActiveItemChange` as the user scrolls.
 *
 * The two pieces share `pendingScrollKeyRef` so the observer holds off until an in-flight smooth
 * scroll reaches its target.
 */
export function useStackedItemScroll({
  containerRef,
  items,
  onActiveItemChange,
  setScrollHandler,
}: UseStackedItemScrollArgs): void {
  // Tracks the in-flight smooth scroll so the observer doesn't sync the active item to whatever
  // it passes over mid-scroll. A ref keeps the observer effect from tearing down on each click.
  const pendingScrollKeyRef = useRef<string | null>(null);

  const scrollToItem = useCallback(
    (item: StackedEditorItem) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const section = findSection(container, item);
      if (!section) {
        return;
      }
      pendingScrollKeyRef.current = getStackedItemKey(item);
      section.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    },
    [containerRef]
  );

  // Register the imperative scroll handler during render. Permitted because the wrapper stores
  // it in a ref (no re-render) and scrollToItem is stable, so this is idempotent.
  setScrollHandler(scrollToItem);

  useActiveStackedItemObserver({
    containerRef,
    itemsKey: getStackedItemsKey(items),
    onActiveItemChange,
    pendingScrollKeyRef,
  });
}

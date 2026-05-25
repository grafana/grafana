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

/**
 * Owns the imperative scroll + active-item observation lifecycle for the stacked editor.
 *
 * Registers an imperative `scrollToItem` with the wrapper via `setScrollHandler`, so sidebar
 * clicks (etc.) can scroll the matching section into view without an effect. Item DOM nodes
 * are discovered through the same `data-stacked-editor-item-*` attributes the observer uses —
 * no parallel ref map needed, which avoids ref-callback churn on every parent re-render.
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
      pendingScrollKeyRef.current = getStackedItemKey(item);
      const sections = container.querySelectorAll<HTMLElement>('[data-stacked-editor-item-id]');
      for (const section of sections) {
        if (section.dataset.stackedEditorItemId === item.id && section.dataset.stackedEditorItemType === item.type) {
          section.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
          return;
        }
      }
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
